"use client";

import Link from "next/link";
import { use, useEffect } from "react";
import { recordTripLookup } from "@/lib/recent-trips";
import { localDate } from "@/lib/trip/format";
import { useTrip } from "@/lib/trip/use-trip";
import { getRecentTrips } from "@/lib/use-recent-trips";
import { TripNotFound } from "./TripNotFound";
import { TripView } from "./TripView";
import styles from "./trip.module.css";

/** `/t/<token>`: loads the trip and picks the screen for its state. */
export function TripScreen({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { state, reload, writer, stalled } = useTrip(token);

  // Every lookup result updates this browser's recent trips (spec 7.2).
  useEffect(() => recordTripLookup(getRecentTrips(), token, state), [token, state]);

  if (state.status === "not_found") return <TripNotFound />;

  const trip = state.status === "found" || state.status === "error" ? state.trip : undefined;
  // The snapshot only arrives in the browser, so the local date is read there too.
  if (trip) return <TripView trip={trip} today={localDate(new Date())} writer={writer} stalled={stalled} />;

  if (state.status === "error") {
    return (
      <main className={styles.message}>
        <Link href="/" className={styles.brand}>
          forj
        </Link>
        <div className={styles.messageArt} aria-hidden>
          📡
        </div>
        <h1 className={styles.messageTitle}>여행을 불러오지 못했어요</h1>
        <p className={styles.messageBody}>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>
        <button type="button" className={styles.primaryButton} onClick={reload}>
          다시 시도
        </button>
      </main>
    );
  }

  return <TripLoading />;
}

export function TripLoading() {
  return (
    <main className={styles.message}>
      <p className={styles.loading} role="status">
        여행을 불러오는 중이에요
      </p>
    </main>
  );
}
