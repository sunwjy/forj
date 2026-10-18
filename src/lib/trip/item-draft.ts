/**
 * The item sheet's input (spec 2.3, 7.4): client checks, normalization, and
 * the patch of changed fields for `update_item` (spec 6.1). The server repeats
 * every check except the grapheme one (spec 5.4).
 */

import type { ItemFields, ItemPatch } from "./changes";
import type { ItemSnapshot } from "./snapshot";

export const MAX_ITEM_TITLE_LENGTH = 100;
export const MAX_MEMO_LENGTH = 2000;
/** The server's cap on the emoji field, in code points (spec 5.4). */
export const MAX_EMOJI_CODE_POINTS = 16;

/** The sheet's form state. Empty optional fields are "". */
export type ItemDraft = {
  emoji: string;
  title: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM` or "" */
  start_time: string;
  /** `HH:MM` or "" */
  end_time: string;
  memo: string;
};

export type ItemDraftField = "emoji" | "title" | "time" | "memo";

export type ItemDraftResult =
  | { ok: true; fields: ItemFields }
  | { ok: false; field: ItemDraftField; message: string };

export function blankDraft(date: string): ItemDraft {
  return { emoji: "", title: "", date, start_time: "", end_time: "", memo: "" };
}

export function draftFromItem(item: ItemFields): ItemDraft {
  return {
    emoji: item.emoji ?? "",
    title: item.title,
    date: item.date,
    start_time: item.start_time ?? "",
    end_time: item.end_time ?? "",
    memo: item.memo ?? "",
  };
}

export function itemFields(item: ItemSnapshot): ItemFields {
  const { date, title, memo, start_time, end_time, emoji } = item;
  return { date, title, memo, start_time, end_time, emoji };
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

  if (draft.end_time && !draft.start_time) {
    return { ok: false, field: "time", message: "종료 시각만 둘 수는 없어요. 시작 시각을 먼저 골라 주세요." };
  }

  // A memo is stored as written; only a blank one becomes null (spec 5.4).
  const memo = draft.memo.trim() === "" ? "" : draft.memo;
  if (codePoints(memo) > MAX_MEMO_LENGTH) {
    return { ok: false, field: "memo", message: `메모는 ${MAX_MEMO_LENGTH.toLocaleString("ko-KR")}자까지 쓸 수 있어요.` };
  }

  return {
    ok: true,
    fields: {
      date: draft.date,
      title,
      memo: memo || null,
      start_time: draft.start_time || null,
      end_time: (draft.start_time && draft.end_time) || null,
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
  if (next.start_time !== base.start_time || next.end_time !== base.end_time) {
    patch.start_time = next.start_time;
    patch.end_time = next.end_time;
  }
  return patch;
}
