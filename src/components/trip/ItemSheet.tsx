"use client";

import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useId, useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { parseHhMm, parseIsoDate } from "@/lib/trip/branded";
import type { ItemFields, ItemPatch } from "@/lib/trip/changes";
import type { Day } from "@/lib/trip/days";
import { dayChipDate, timeLabel } from "@/lib/trip/format";
import {
  MAX_ITEM_TITLE_LENGTH,
  MAX_MEMO_LENGTH,
  itemFields,
  itemPatch,
  validateItemDraft,
  type ItemDraft,
  type ItemDraftField,
} from "@/lib/trip/item-draft";
import { addMinutes, durationMinutes, overlappingItems } from "@/lib/trip/item-time";
import { mergeRemoteItem, type RemoteMark } from "@/lib/trip/remote-edit";
import type { ItemSnapshot } from "@/lib/trip/snapshot";
import { useRemoteEdits } from "@/lib/trip/use-remote-edits";
import styles from "./ItemSheet.module.css";
import { OfflineBadge } from "./OfflineBadge";
import { RemoteNote, remoteClass } from "./RemoteField";

/** Common travel emoji offered next to the phone's emoji keyboard (spec 7.4). */
const SUGGESTED_EMOJI = ["✈️", "🚃", "🚌", "🏨", "🍜", "🍣", "☕️", "🍺", "📸", "🛍️", "🎢", "⛩️", "🌇"];

const DURATIONS = [30, 60, 90, 120, 180];

export type ItemSheetTarget =
  /** `key` changes every time the sheet opens, so the form starts fresh. */
  | { key: number; mode: "new"; draft: ItemDraft }
  /** `base` is the item when the sheet opened; only fields that differ from it are sent. */
  | { key: number; mode: "edit"; id: string; base: ItemFields; draft: ItemDraft };

type ItemSheetProps = {
  /** `null` closes the sheet. */
  target: ItemSheetTarget | null;
  days: Day[];
  /** The trip's items as shown, for the overlap notice and to notice someone else's edit or deletion. */
  items: ItemSnapshot[];
  /** Shows the connection-lost badge atop the sheet (spec 7.7). */
  offline?: boolean;
  onClose: () => void;
  onCreate: (fields: ItemFields) => void;
  onUpdate: (id: string, patch: ItemPatch) => void;
  onDelete: (id: string) => void;
  /** Reopens the current input as a new item. */
  onReAdd: (draft: ItemDraft) => void;
};

/** The add/edit item bottom sheet (spec 7.4). */
export function ItemSheet({ target, days, items, onClose, ...actions }: ItemSheetProps) {
  // Keeps the last form on screen, as it was, while the sheet slides away;
  // a just-saved item would otherwise show up in it as an overlap.
  const [shown, setShown] = useState({ target, items });
  if (target && (target !== shown.target || items !== shown.items)) setShown({ target, items });
  const form = shown.target;

  return (
    <BottomSheet open={target !== null} onClose={onClose} title={form?.mode === "edit" ? "일정 편집" : "새 일정"}>
      {form && <ItemForm key={form.key} target={form} days={days} items={shown.items} onClose={onClose} {...actions} />}
    </BottomSheet>
  );
}

/** Picks 과/와-style particles by whether the word ends in a final consonant. */
function particle(word: string, afterConsonant: string, afterVowel: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? afterConsonant : afterVowel;
  return `${afterVowel}(${afterConsonant})`;
}

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(" ");
}

function overlapNotice(overlaps: ItemSnapshot[]): string | null {
  if (overlaps.length === 0) return null;
  const [first] = overlaps;
  const who =
    overlaps.length === 1
      ? `${timeLabel(first)} 「${first.title}」${particle(first.title, "과", "와")}`
      : `${timeLabel(first)} 「${first.title}」 외 ${overlaps.length - 1}개 일정과`;
  return `⏰ ${who} 시간이 겹쳐요. 그대로 저장할 수 있어요.`;
}

type ItemFormProps = Omit<ItemSheetProps, "target"> & { target: ItemSheetTarget };

function ItemForm({ target, days, items, offline, onClose, onCreate, onUpdate, onDelete, onReAdd }: ItemFormProps) {
  const id = useId();
  const editing = target.mode === "edit";
  const current = editing ? items.find((i) => i.id === target.id) : undefined;
  // Someone else deleted the item while the sheet was open (spec 6.5).
  const deleted = editing && !current;

  // The item as last seen, so saving sends only my edits (spec 6.1); a
  // refetch with someone else's edit is merged into the form (spec 7.7).
  const { base, draft, setDraft, marks } = useRemoteEdits({
    initialBase: target.mode === "edit" ? target.base : undefined,
    initialDraft: target.draft,
    latest: current && itemFields(current),
    differs: (seen, latest) => Object.keys(itemPatch(seen, latest)).length > 0,
    merge: mergeRemoteItem,
  });
  const [error, setError] = useState<{ field: ItemDraftField; message: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const remote = (...fields: (keyof ItemDraft)[]): RemoteMark | undefined => {
    const found = fields.map((f) => marks[f]).filter(Boolean);
    return found.includes("mine") ? "mine" : found[0];
  };
  const fieldClass = (mark: RemoteMark | undefined) => remoteClass(styles.field, mark);

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // The form holds what was typed; only well-formed values feed the live hints.
  const date = parseIsoDate(draft.date);
  const startTime = parseHhMm(draft.startTime);
  const endTime = parseHhMm(draft.endTime);
  const overlaps =
    date && startTime && endTime
      ? overlappingItems({ id: editing ? target.id : "", date, startTime, endTime }, items)
      : [];
  const notice = overlapNotice(overlaps);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleted) return;
    const checked = validateItemDraft(draft);
    if (!checked.ok) {
      setError({ field: checked.field, message: checked.message });
      return;
    }
    if (target.mode === "new" || !base) {
      onCreate(checked.fields);
    } else {
      const patch = itemPatch(base, checked.fields);
      if (Object.keys(patch).length > 0) onUpdate(target.id, patch);
    }
    onClose();
  }

  const invalid = (field: ItemDraftField) => error?.field === field;
  /** The error under a field, tied to its input by the enclosing Field.Root. */
  const fieldError = (field: ItemDraftField) =>
    invalid(field) && (
      <Field.Error match className={styles.error} role="alert">
        {error?.message}
      </Field.Error>
    );
  // The time error describes both inputs, so it sits outside either Field and each input points at it.
  const timeErrorId = invalid("time") ? `${id}-time-error` : undefined;
  const customEmoji = SUGGESTED_EMOJI.includes(draft.emoji) ? "" : draft.emoji;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {offline && (
        <p className={styles.offlineLine}>
          <OfflineBadge />
        </p>
      )}
      {deleted && (
        <div className={styles.deletedBanner} role="alert">
          삭제된 일정입니다. 다른 사람이 이 일정을 지웠어요.
          <div className={styles.bannerActions}>
            <Button className={styles.softButton} onClick={() => onReAdd(draft)}>
              새 일정으로 추가
            </Button>
            <Button className={styles.ghostButton} onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      )}

      <fieldset className={fieldClass(remote("emoji"))}>
        <legend>아이콘</legend>
        <Field.Root invalid={invalid("emoji")} className={styles.emojis}>
          <ToggleGroup
            className={styles.emojiGroup}
            aria-label="추천 이모지"
            value={SUGGESTED_EMOJI.includes(draft.emoji) ? [draft.emoji] : []}
            // Pressing the chosen emoji again clears it.
            onValueChange={(value) => set("emoji", value[0] ?? "")}
          >
            {SUGGESTED_EMOJI.map((emoji) => (
              <Toggle key={emoji} value={emoji} className={styles.emoji}>
                {emoji}
              </Toggle>
            ))}
          </ToggleGroup>
          <Field.Control
            className={styles.emojiInput}
            value={customEmoji}
            onChange={(event) => set("emoji", event.target.value)}
            placeholder="직접"
            aria-label="이모지 직접 입력"
            autoComplete="off"
            maxLength={32}
          />
          {fieldError("emoji")}
        </Field.Root>
        <RemoteNote mark={remote("emoji")} />
      </fieldset>

      <Field.Root invalid={invalid("title")} className={fieldClass(remote("title"))}>
        <Field.Label>제목</Field.Label>
        <Field.Control
          value={draft.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="예: 이치란 라멘"
          autoComplete="off"
          enterKeyHint="done"
          // The browser counts UTF-16 units; the code-point limit is checked on save.
          maxLength={MAX_ITEM_TITLE_LENGTH * 2}
        />
        {fieldError("title")}
        <RemoteNote mark={remote("title")} />
      </Field.Root>

      <Field.Root className={fieldClass(remote("date"))}>
        <Field.Label>일차</Field.Label>
        {/* A native select keeps the phone's own picker. */}
        <Field.Control
          render={<select />}
          value={draft.date}
          onChange={(event) => set("date", event.target.value)}
        >
          {days.map((day) => (
            <option key={day.date} value={day.date}>
              {day.number}일차 · {dayChipDate(day.date)}
            </option>
          ))}
        </Field.Control>
        <RemoteNote mark={remote("date")} />
      </Field.Root>

      <fieldset className={fieldClass(remote("startTime", "endTime"))}>
        <legend>
          시각 <span className={styles.legendNote}>(비워 두면 「시간 미정」)</span>
        </legend>
        <div className={styles.row}>
          <Field.Root invalid={invalid("time")}>
            <Field.Control
              type="time"
              aria-label="시작 시각"
              value={draft.startTime}
              onChange={(event) => {
                const start = event.target.value;
                // An end time needs a start time (spec 2.3).
                setDraft((d) => ({ ...d, startTime: start, endTime: start ? d.endTime : "" }));
              }}
              aria-describedby={timeErrorId}
            />
          </Field.Root>
          <Field.Root invalid={invalid("time")} disabled={!draft.startTime}>
            <Field.Control
              type="time"
              aria-label="종료 시각"
              value={draft.endTime}
              onChange={(event) => set("endTime", event.target.value)}
              aria-describedby={timeErrorId}
            />
          </Field.Root>
        </div>
        {invalid("time") && (
          <p id={timeErrorId} className={styles.error} role="alert">
            {error?.message}
          </p>
        )}
        {startTime && (
          <div className={styles.durations}>
            <span className={styles.durationLabel}>
              {endTime
                ? `소요 ${durationLabel(durationMinutes(startTime, endTime))}${
                    endTime <= startTime ? " · 다음 날 끝나요" : ""
                  }`
                : "소요 시간"}
            </span>
            <ToggleGroup
              className={styles.durationGroup}
              aria-label="소요 시간"
              value={DURATIONS.filter((minutes) => endTime === addMinutes(startTime, minutes)).map(String)}
              onValueChange={(value) => {
                // Pressing the current duration again keeps it rather than clearing the end time.
                if (value[0]) set("endTime", addMinutes(startTime, Number(value[0])));
              }}
            >
              {DURATIONS.map((minutes) => (
                <Toggle key={minutes} value={String(minutes)} className={styles.chip}>
                  {durationLabel(minutes)}
                </Toggle>
              ))}
            </ToggleGroup>
            <Button className={styles.chip} onClick={() => setDraft((d) => ({ ...d, startTime: "", endTime: "" }))}>
              시각 지우기
            </Button>
          </div>
        )}
        {notice && (
          <p className={styles.hint} role="status">
            {notice}
          </p>
        )}
        <RemoteNote mark={remote("startTime", "endTime")} />
      </fieldset>

      <Field.Root invalid={invalid("memo")} className={fieldClass(remote("memo"))}>
        <Field.Label>메모</Field.Label>
        <Field.Control
          render={<textarea />}
          value={draft.memo}
          onChange={(event) => set("memo", event.target.value)}
          placeholder="예약 번호, 주소, 준비물"
          maxLength={MAX_MEMO_LENGTH * 2}
        />
        {fieldError("memo")}
        <RemoteNote mark={remote("memo")} />
      </Field.Root>

      <div className={styles.actions}>
        {editing && (
          // Disabled buttons stay focusable, so screen reader users still find them after a deletion.
          <Button
            className={styles.dangerButton}
            disabled={deleted}
            focusableWhenDisabled
            onClick={() => setConfirmingDelete(true)}
          >
            삭제
          </Button>
        )}
        <Button type="submit" className={styles.saveButton} disabled={deleted} focusableWhenDisabled>
          저장
        </Button>
      </div>

      {editing && (
        <ConfirmDialog
          open={confirmingDelete}
          title="이 일정을 삭제할까요?"
          body={`「${target.base.title}」${particle(target.base.title, "을", "를")} 함께 쓰는 모든 사람의 여행에서 지웁니다. 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          danger
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete(target.id);
            onClose();
          }}
        />
      )}
    </form>
  );
}
