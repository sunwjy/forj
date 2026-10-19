/**
 * The item sheet's input (spec 2.3, 7.4): client checks, normalization, and
 * the patch of changed fields for `update_item` (spec 6.1). The server repeats
 * every check except the grapheme one (spec 5.4).
 */

import { parseHhMm, parseIsoDate, type IsoDate } from "./branded";
import type { ItemFields, ItemPatch } from "./changes";
import type { ItemSnapshot } from "./snapshot";

export const MAX_ITEM_TITLE_LENGTH = 100;
export const MAX_MEMO_LENGTH = 2000;
/** The server's cap on the emoji field, in code points (spec 5.4). */
export const MAX_EMOJI_CODE_POINTS = 16;

/** The sheet's form state, as typed. Empty optional fields are "". */
export type ItemDraft = {
  emoji: string;
  title: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM` or "" */
  startTime: string;
  /** `HH:MM` or "" */
  endTime: string;
  memo: string;
};

export type ItemDraftField = "emoji" | "title" | "date" | "time" | "memo";

export type ItemDraftResult =
  | { ok: true; fields: ItemFields }
  | { ok: false; field: ItemDraftField; message: string };

export function blankDraft(date: IsoDate): ItemDraft {
  return { emoji: "", title: "", date, startTime: "", endTime: "", memo: "" };
}

export function draftFromItem(item: ItemFields): ItemDraft {
  return {
    emoji: item.emoji ?? "",
    title: item.title,
    date: item.date,
    startTime: item.startTime ?? "",
    endTime: item.endTime ?? "",
    memo: item.memo ?? "",
  };
}

export function itemFields(item: ItemSnapshot): ItemFields {
  const { date, title, memo, startTime, endTime, emoji } = item;
  return { date, title, memo, startTime, endTime, emoji };
}

/** Lengths are counted in code points, like `char_length` on the server (spec 2.3). */
function codePoints(text: string): number {
  return [...text].length;
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter() : undefined;

/** Pictographs, flags (regional indicators) and keycaps such as 1️⃣. */
const EMOJI_LIKE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

/** Exactly one grapheme that is an emoji, within the server's length cap. */
export function isSingleEmoji(text: string): boolean {
  if (text === "" || codePoints(text) > MAX_EMOJI_CODE_POINTS) return false;
  if (!EMOJI_LIKE.test(text)) return false;
  // Without Intl.Segmenter (very old browsers) the server's length cap still applies.
  if (!segmenter) return true;
  return [...segmenter.segment(text)].length === 1;
}

export function validateItemDraft(draft: ItemDraft): ItemDraftResult {
  const emoji = draft.emoji.trim();
  if (emoji && !isSingleEmoji(emoji)) {
    return { ok: false, field: "emoji", message: "아이콘은 이모지 하나만 고를 수 있어요." };
  }

  const title = draft.title.trim();
  if (title === "") {
    return { ok: false, field: "title", message: "제목을 입력해 주세요." };
  }
  if (codePoints(title) > MAX_ITEM_TITLE_LENGTH) {
    return { ok: false, field: "title", message: `제목은 ${MAX_ITEM_TITLE_LENGTH}자까지 쓸 수 있어요.` };
  }

  const date = parseIsoDate(draft.date);
  if (!date) {
    return { ok: false, field: "date", message: "일차를 골라 주세요." };
  }

  if (draft.endTime && !draft.startTime) {
    return { ok: false, field: "time", message: "종료 시각만 둘 수는 없어요. 시작 시각을 먼저 골라 주세요." };
  }
  const startTime = draft.startTime ? parseHhMm(draft.startTime) : null;
  const endTime = draft.endTime ? parseHhMm(draft.endTime) : null;
  if ((draft.startTime && !startTime) || (draft.endTime && !endTime)) {
    return { ok: false, field: "time", message: "시각을 다시 골라 주세요." };
  }

  // A memo is stored as written; only a blank one becomes null (spec 5.4).
  const memo = draft.memo.trim() === "" ? "" : draft.memo;
  if (codePoints(memo) > MAX_MEMO_LENGTH) {
    return { ok: false, field: "memo", message: `메모는 ${MAX_MEMO_LENGTH.toLocaleString("ko-KR")}자까지 쓸 수 있어요.` };
  }

  return {
    ok: true,
    fields: {
      date,
      title,
      memo: memo || null,
      startTime,
      endTime,
      emoji: emoji || null,
    },
  };
}

const SINGLE_FIELDS = ["date", "title", "memo", "emoji"] as const;

/**
 * The fields of `next` that differ from `base`, the item as it was when the
 * sheet opened. The start and end times go together if either changed (spec 6.1).
 */
export function itemPatch(base: ItemFields, next: ItemFields): ItemPatch {
  const patch: ItemPatch = {};
  for (const key of SINGLE_FIELDS) {
    if (next[key] !== base[key]) Object.assign(patch, { [key]: next[key] });
  }
  if (next.startTime !== base.startTime || next.endTime !== base.endTime) {
    patch.startTime = next.startTime;
    patch.endTime = next.endTime;
  }
  return patch;
}
