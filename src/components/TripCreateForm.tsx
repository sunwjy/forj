"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { createTrip } from "@/lib/create-trip";
import { getSupabase } from "@/lib/supabase";
import { MAX_PERIOD_DAYS, MAX_TITLE_LENGTH, validateTripInput, type TripInput } from "@/lib/trip-input";
import { showToast } from "./toast";
import styles from "./TripCreateForm.module.css";

export type CreatedTrip = TripInput & { token: string };

type TripCreateFormProps = {
  /** Runs after the trip exists and before navigating to it, e.g. to remember it as a recent trip. */
  onCreated?: (trip: CreatedTrip) => void;
};

const DISABLED_MESSAGE = "지금은 여행을 만들 수 없습니다. 잠시 후 다시 시도해 주세요.";
const FAILED_MESSAGE = "여행을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
const CREATED_TOAST = "여행을 만들었어요. 🔗를 눌러 링크를 보내 보세요.";

/**
 * The trip creation form (spec 7.1): title, start date, end date. On success it
 * opens `/t/<token>` and shows a toast about sharing. On failure the input stays.
 */
export function TripCreateForm({ onCreated }: TripCreateFormProps) {
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<{ field: "title" | "period" | "form"; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const checked = validateTripInput({ title, startDate, endDate });
    if (!checked.ok) {
      setError({ field: checked.field, message: checked.message });
      return;
    }

    setError(null);
    setPending(true);
    const result = await createTrip(getSupabase(), checked.value);
    if (!result.ok) {
      setPending(false);
      setError({ field: "form", message: result.reason === "disabled" ? DISABLED_MESSAGE : FAILED_MESSAGE });
      return;
    }

    onCreated?.({ ...checked.value, token: result.token });
    showToast(CREATED_TOAST);
    router.push(`/t/${result.token}`);
    // Next.js keeps this route's state for back navigation; come back to an empty form.
    setTitle("");
    setStartDate("");
    setEndDate("");
    setPending(false);
  }

  const errorId = `${id}-error`;
  const describe = (field: "title" | "period") => (error?.field === field ? errorId : undefined);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor={`${id}-title`}>여행 제목</label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 오사카 먹방 여행"
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={error?.field === "title"}
          aria-describedby={describe("title")}
          // The browser counts UTF-16 units; the code-point limit is checked on submit.
          maxLength={MAX_TITLE_LENGTH * 2}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${id}-start`}>시작일</label>
          <input
            id={`${id}-start`}
            type="date"
            value={startDate}
            onChange={(event) => {
              const next = event.target.value;
              setStartDate(next);
              // Most people pick the start first; keep the end from landing before it.
              if (next && (!endDate || endDate < next)) setEndDate(next);
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
            onChange={(event) => setEndDate(event.target.value)}
            aria-invalid={error?.field === "period"}
            aria-describedby={describe("period")}
          />
        </div>
      </div>
      <p className={styles.hint}>기간은 최대 {MAX_PERIOD_DAYS}일까지 정할 수 있어요.</p>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error.message}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "만드는 중…" : "여행 만들기"}
      </button>
    </form>
  );
}
