"use client";

import Link from "next/link";
import { useState } from "react";
import { periodLabel } from "@/lib/trip/format";
import { getRecentTrips, useRecentTrips } from "@/lib/use-recent-trips";
import { showToast } from "./toast";
import { TripCreateForm, type CreatedTrip } from "./TripCreateForm";
import { TripCreateSheet } from "./TripCreateSheet";
import styles from "./Home.module.css";

const FORGOTTEN_TOAST = "최근 여행 목록에서 지웠어요";

function rememberCreated(trip: CreatedTrip) {
  getRecentTrips().remember(trip);
}

/**
 * The first screen below the brand (spec 7.1). With no recent trips it shows
 * the introduction and the creation form; otherwise 「＋ 새 여행 만들기」 (form in
 * a bottom sheet) above the recent trips list, drawn from local snapshots only.
 */
export function Home() {
  const trips = useRecentTrips();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Recent trips live in this browser only, so the server render leaves this part empty.
  if (trips === null) return null;

  if (trips.length === 0) {
    return (
      <>
        <section className={styles.hero}>
          <div className={styles.emoji} aria-hidden>
            🧳
          </div>
          <h1 className="display">함께 짜는 여행 일정표</h1>
          <p>가입 없이 링크 하나로 일행과 함께 편집해요.</p>
        </section>
        <section className={styles.card} aria-label="여행 만들기">
          <TripCreateForm onCreated={rememberCreated} />
        </section>
      </>
    );
  }

  function forget(token: string) {
    const recent = getRecentTrips();
    const forgotten = recent.forget(token);
    if (!forgotten) return;
    showToast(FORGOTTEN_TOAST, { label: "되돌리기", onClick: () => recent.restore(forgotten) });
  }

  return (
    <>
      <button type="button" className={styles.newTrip} onClick={() => setSheetOpen(true)}>
        ＋ 새 여행 만들기
      </button>
      <section aria-labelledby="recent-trips-title">
        <h1 id="recent-trips-title" className={styles.sectionTitle}>
          최근 여행
        </h1>
        <ul className={styles.list}>
          {trips.map((trip) => (
            <li key={trip.token} className={styles.row}>
              <Link href={`/t/${trip.token}`} className={styles.open}>
                <b className="display">{trip.title}</b>
                <span className="num">{periodLabel(trip.startDate, trip.endDate)}</span>
              </Link>
              <button
                type="button"
                className={styles.forget}
                aria-label={`「${trip.title}」 목록에서 지우기`}
                title="목록에서 지우기"
                onClick={() => forget(trip.token)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.note}>이 브라우저에서 만들거나 열었던 여행이에요. 목록에서 지워도 여행은 남아 있어요.</p>
      </section>
      <TripCreateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={(trip) => {
          rememberCreated(trip);
          setSheetOpen(false);
        }}
      />
    </>
  );
}
