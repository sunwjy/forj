"use client";

import { Button } from "@base-ui/react/button";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { createTrip } from "@/lib/trip/create-trip";
import { getSupabase } from "@/lib/supabase";
import { validateTripInput, type TripDraft } from "@/lib/trip/trip-input";
import { showToast } from "@/components/toast";
import { TripFields, type TripFieldsError } from "@/components/trip/TripFields";
import styles from "./TripCreateForm.module.css";

export type CreatedTrip = TripDraft & { token: string };

type TripCreateFormProps = {
  /** Runs after the trip exists and before navigating to it, e.g. to remember it as a recent trip. */
  onCreated?: (trip: CreatedTrip) => void;
};

const DISABLED_MESSAGE = "지금은 여행을 만들 수 없습니다. 잠시 후 다시 시도해 주세요.";
const FAILED_MESSAGE = "여행을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
const CREATED_TOAST = "여행을 만들었어요. 위쪽 공유 버튼으로 링크를 보내 보세요.";

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
  const [error, setError] = useState<TripFieldsError | null>(null);
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

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TripFields
        id={id}
        value={{ title, startDate, endDate }}
        onChange={(next) => {
          setTitle(next.title);
          setStartDate(next.startDate);
          setEndDate(next.endDate);
        }}
        error={error}
      />
      {error?.field === "form" && (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      )}
      {/* Stays focusable while creating, so focus isn't dropped mid-request. */}
      <Button type="submit" className={styles.submit} disabled={pending} focusableWhenDisabled>
        {pending ? "만드는 중…" : "여행 만들기"}
      </Button>
    </form>
  );
}
