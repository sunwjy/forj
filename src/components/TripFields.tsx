"use client";

import { RemoteNote, remoteClass } from "@/components/trip/RemoteField";
import { MAX_PERIOD_DAYS, MAX_TITLE_LENGTH, type TripDraft } from "@/lib/trip-input";
import type { RemoteMark, RemoteMarks } from "@/lib/trip/remote-edit";
import styles from "./TripCreateForm.module.css";

type TripFieldsProps = {
  /** Prefix for the inputs' ids, from `useId`. */
  id: string;
  value: TripDraft;
  onChange: (value: TripDraft) => void;
  /** The field the current error is about, and the id of the element describing it. */
  error?: { field: "title" | "period" | "form"; describedBy: string } | null;
  /** Fields someone else changed while the edit sheet was open (spec 7.7). */
  remote?: RemoteMarks<keyof TripDraft>;
};

/** A trip's title, start date and end date (spec 2.1), for creating a trip and for editing it. */
export function TripFields({ id, value, onChange, error, remote = {} }: TripFieldsProps) {
  const describe = (field: "title" | "period") => (error?.field === field ? error.describedBy : undefined);
  const { title, startDate, endDate } = value;
  const periodMarks = [remote.startDate, remote.endDate];
  const periodMark: RemoteMark | undefined = periodMarks.includes("mine") ? "mine" : periodMarks.find(Boolean);

  return (
    <>
      <div className={remoteClass(styles.field, remote.title)}>
        <label htmlFor={`${id}-title`}>여행 제목</label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="예: 오사카 먹방 여행"
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={error?.field === "title"}
          aria-describedby={describe("title")}
          // The browser counts UTF-16 units; the code-point limit is checked on submit.
          maxLength={MAX_TITLE_LENGTH * 2}
        />
        <RemoteNote mark={remote.title} />
      </div>
      <div className={remoteClass(styles.row, periodMark)}>
        <div className={styles.field}>
          <label htmlFor={`${id}-start`}>시작일</label>
          <input
            id={`${id}-start`}
            type="date"
            value={startDate}
            onChange={(event) => {
              const next = event.target.value;
              // Most people pick the start first; keep the end from landing before it.
              onChange({ ...value, startDate: next, endDate: next && (!endDate || endDate < next) ? next : endDate });
            }}
            aria-invalid={error?.field === "period"}
            aria-describedby={describe("period")}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-end`}>종료일</label>
          <input
            id={`${id}-end`}
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onChange({ ...value, endDate: event.target.value })}
            aria-invalid={error?.field === "period"}
            aria-describedby={describe("period")}
          />
        </div>
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
