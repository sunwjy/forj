"use client";

import { Field } from "@base-ui/react/field";
import { RemoteNote, remoteClass } from "@/components/trip/RemoteField";
import { MAX_PERIOD_DAYS, MAX_TITLE_LENGTH, type TripDraft } from "@/lib/trip-input";
import type { RemoteMark, RemoteMarks } from "@/lib/trip/remote-edit";
import styles from "./TripCreateForm.module.css";

export type TripFieldsError = { field: "title" | "period" | "form"; message: string };

type TripFieldsProps = {
  /** Prefix for element ids, from `useId`. */
  id: string;
  value: TripDraft;
  onChange: (value: TripDraft) => void;
  /** Title and period errors are shown here, next to their fields; the form shows `form` errors. */
  error?: TripFieldsError | null;
  /** Fields someone else changed while the edit sheet was open (spec 7.7). */
  remote?: RemoteMarks<keyof TripDraft>;
};

/**
 * A trip's title, start date and end date (spec 2.1), for creating a trip and
 * for editing it. Base UI's Field ties each label and error to its input.
 */
export function TripFields({ id, value, onChange, error, remote = {} }: TripFieldsProps) {
  const { title, startDate, endDate } = value;
  const periodMarks = [remote.startDate, remote.endDate];
  const periodMark: RemoteMark | undefined = periodMarks.includes("mine") ? "mine" : periodMarks.find(Boolean);
  const periodInvalid = error?.field === "period";
  // One message describes both dates, so it sits outside either Field and each input points at it.
  const periodErrorId = periodInvalid ? `${id}-period-error` : undefined;

  return (
    <>
      <Field.Root invalid={error?.field === "title"} className={remoteClass(styles.field, remote.title)}>
        <Field.Label>여행 제목</Field.Label>
        <Field.Control
          value={title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="예: 오사카 먹방 여행"
          autoComplete="off"
          enterKeyHint="next"
          // The browser counts UTF-16 units; the code-point limit is checked on submit.
          maxLength={MAX_TITLE_LENGTH * 2}
        />
        {error?.field === "title" && (
          <Field.Error match className={styles.error} role="alert">
            {error.message}
          </Field.Error>
        )}
        <RemoteNote mark={remote.title} />
      </Field.Root>
      <div className={remoteClass(styles.row, periodMark)}>
        <Field.Root invalid={periodInvalid} className={styles.field}>
          <Field.Label>시작일</Field.Label>
          <Field.Control
            type="date"
            value={startDate}
            onChange={(event) => {
              const next = event.target.value;
              // Most people pick the start first; keep the end from landing before it.
              onChange({ ...value, startDate: next, endDate: next && (!endDate || endDate < next) ? next : endDate });
            }}
            aria-describedby={periodErrorId}
          />
        </Field.Root>
        <Field.Root invalid={periodInvalid} className={styles.field}>
          <Field.Label>종료일</Field.Label>
          <Field.Control
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onChange({ ...value, endDate: event.target.value })}
            aria-describedby={periodErrorId}
          />
        </Field.Root>
        {error?.field === "period" && (
          <p id={periodErrorId} className={`${styles.rowNote} ${styles.error}`} role="alert">
            {error.message}
          </p>
        )}
        {periodMark && (
          <div className={styles.rowNote}>
            <RemoteNote mark={periodMark} />
          </div>
        )}
      </div>
      <p className={styles.hint}>기간은 최대 {MAX_PERIOD_DAYS}일까지 정할 수 있어요.</p>
    </>
  );
}
