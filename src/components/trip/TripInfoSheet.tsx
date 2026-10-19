"use client";

import { Button } from "@base-ui/react/button";
import { useId, useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showToast } from "@/components/toast";
import { TripFields, type TripFieldsError } from "./TripFields";
import fieldStyles from "./TripFields.module.css";
import { validateTripInput, type Period, type TripDraft } from "@/lib/trip/trip-input";
import { dayChipDate } from "@/lib/trip/format";
import { periodChange } from "@/lib/trip/period-change";
import type { TripSnapshot } from "@/lib/trip/snapshot";
import { mergeRemoteFields } from "@/lib/trip/remote-edit";
import { useRemoteEdits } from "@/lib/trip/use-remote-edits";
import { useRejections, type TripWriter } from "@/lib/trip/use-trip";
import { OfflineBadge } from "./OfflineBadge";
import styles from "./TripInfoSheet.module.css";

const DEFAULT_EMOJI = "📍";
const FAILED_TOAST = "저장하지 못했어요";

/** `key` changes every time the sheet opens, so the form starts fresh. */
type SheetTarget = { key: number; draft: TripDraft };

function draftOf(trip: TripSnapshot): TripDraft {
  return { title: trip.title, startDate: trip.start_date, endDate: trip.end_date };
}

type TripInfoSheetProps = {
  /** The rebased view: server snapshot plus pending changes. */
  trip: TripSnapshot;
  writer: TripWriter;
  /** Changes every time the edit (pencil) button is pressed; `0` means not yet. */
  openRequest: number;
  /** Shows the connection-lost badge atop the sheet (spec 7.7). */
  offline?: boolean;
};

/**
 * Editing a trip's title and period (spec 2.6, 7.5): the 「여행 정보」 sheet,
 * the confirmation when shrinking the period deletes items, and the handling
 * of rejected trip changes (spec 6.5).
 */
export function TripInfoSheet({ trip, writer, openRequest, offline = false }: TripInfoSheetProps) {
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  // Re-asked after DELETION_MISMATCH, with the sheet already closed.
  const [retry, setRetry] = useState<Period | null>(null);

  const open = (draft: TripDraft) => setSheet((s) => ({ key: (s?.key ?? 0) + 1, draft }));

  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    setSheet((s) => ({ key: (s?.key ?? 0) + 1, draft: draftOf(trip) }));
  }

  function submitPeriod({ startDate, endDate }: Period) {
    writer.submit({
      kind: "set_trip_dates",
      start_date: startDate,
      end_date: endDate,
      deleted_ids: periodChange(trip, startDate, endDate).deletedItems.map((i) => i.id),
    });
  }

  // The store has already reverted the change (spec 6.5).
  useRejections(writer, ({ change, code }) => {
    if (change.kind === "set_trip_dates") {
      const period = { startDate: change.start_date, endDate: change.end_date };
      if (code === "DELETION_MISMATCH") {
        // The list follows the refetched snapshot, so it shows the latest items.
        setRetry(period);
      } else {
        showToast(FAILED_TOAST, { label: "다시 편집", onClick: () => open({ ...draftOf(trip), ...period }) });
      }
    } else if (change.kind === "update_trip_title") {
      showToast(FAILED_TOAST, { label: "다시 편집", onClick: () => open({ ...draftOf(trip), title: change.title }) });
    }
  });

  // Keeps the last form on screen while the sheet slides away.
  const [shown, setShown] = useState(sheet);
  if (sheet && sheet !== shown) setShown(sheet);

  return (
    <>
      <BottomSheet open={sheet !== null} onClose={() => setSheet(null)} title="여행 정보">
        {shown && (
          <TripInfoForm
            key={shown.key}
            trip={trip}
            draft={shown.draft}
            offline={offline}
            onSave={(title, period) => {
              if (title !== undefined) writer.submit({ kind: "update_trip_title", title });
              if (period) submitPeriod(period);
              setSheet(null);
            }}
          />
        )}
      </BottomSheet>
      <PeriodConfirmDialog
        open={retry !== null}
        trip={trip}
        period={retry}
        retry
        onCancel={() => setRetry(null)}
        onConfirm={() => {
          if (retry) submitPeriod(retry);
          setRetry(null);
        }}
      />
    </>
  );
}

type TripInfoFormProps = {
  trip: TripSnapshot;
  draft: TripDraft;
  offline: boolean;
  /** Only what differs from the trip when the sheet opened (spec 6.1). */
  onSave: (title: string | undefined, period: Period | undefined) => void;
};

function TripInfoForm({ trip, draft: initial, offline, onSave }: TripInfoFormProps) {
  const id = useId();
  // What the sheet compares against to send only what changed: the trip as
  // last seen. A refetch with someone else's edit is merged in (spec 7.7).
  const latest = draftOf(trip);
  const { base = latest, draft, setDraft, marks } = useRemoteEdits({
    initialBase: latest,
    initialDraft: initial,
    latest,
    differs: (seen, now) =>
      seen.title !== now.title || seen.startDate !== now.startDate || seen.endDate !== now.endDate,
    merge: (seen: TripDraft, mine: TripDraft, now: TripDraft) => ({ base: now, ...mergeRemoteFields(seen, mine, now) }),
  });
  const [error, setError] = useState<TripFieldsError | null>(null);
  const [pending, setPending] = useState<{ title: string | undefined; period: Period } | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateTripInput(draft);
    if (!checked.ok) {
      setError({ field: checked.field, message: checked.message });
      return;
    }
    setError(null);
    const { title, startDate, endDate } = checked.value;
    const newTitle = title !== base.title ? title : undefined;
    const period = startDate !== base.startDate || endDate !== base.endDate ? { startDate, endDate } : undefined;
    if (period && periodChange(trip, startDate, endDate).deletedItems.length > 0) {
      setPending({ title: newTitle, period });
      return;
    }
    onSave(newTitle, period);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {offline && (
        <p>
          <OfflineBadge />
        </p>
      )}
      <TripFields
        id={id}
        value={draft}
        onChange={setDraft}
        error={error}
        remote={marks}
      />
      <p className={fieldStyles.hint}>기간을 줄이면 빠지는 날짜의 일정이 함께 삭제돼요. 저장하기 전에 한 번 더 확인해요.</p>
      <Button type="submit" className={styles.submit}>
        저장
      </Button>
      <PeriodConfirmDialog
        open={pending !== null}
        trip={trip}
        period={pending?.period ?? null}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onSave(pending.title, pending.period);
        }}
      />
    </form>
  );
}

type PeriodConfirmDialogProps = {
  open: boolean;
  trip: TripSnapshot;
  period: Period | null;
  /** Asked again because the items to delete changed meanwhile (DELETION_MISMATCH). */
  retry?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Shows the dates leaving the trip and the items deleted with them (spec 2.6).
 * There is no undo, so this is always shown before such a change. The list is
 * computed from `trip` as it is now, so it stays current while open.
 */
function PeriodConfirmDialog({ open, trip, period, retry = false, onConfirm, onCancel }: PeriodConfirmDialogProps) {
  const { removedDates, deletedItems } = period
    ? periodChange(trip, period.startDate, period.endDate)
    : { removedDates: [], deletedItems: [] };
  const dates = removedDates.map(dayChipDate).join(", ");
  const changed = retry ? "그 사이 일정이 바뀌었어요. " : "";

  const title = deletedItems.length > 0 ? `일정 ${deletedItems.length}개가 함께 삭제돼요` : "기간을 바꿀까요?";
  const body =
    deletedItems.length > 0
      ? `${changed}빠지는 날짜: ${dates}. 이 날짜의 일정이 함께 쓰는 모든 사람의 여행에서 사라지며, 되돌릴 수 없어요.`
      : `${changed}지금은 기간에서 빠지는 날짜에 일정이 없어요.`;

  return (
    <ConfirmDialog
      open={open}
      title={title}
      body={body}
      confirmLabel={deletedItems.length > 0 ? "삭제하고 기간 변경" : "기간 변경"}
      danger={deletedItems.length > 0}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {deletedItems.length > 0 && (
        <ul className={styles.doomed} aria-label="삭제될 일정">
          {deletedItems.map((item) => (
            <li key={item.id}>
              <span aria-hidden>{item.emoji ?? DEFAULT_EMOJI}</span> {item.title}
              <span className={`${styles.doomedDate} num`}>
                {dayChipDate(item.date)}
                {item.start_time && ` · ${item.start_time}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}
