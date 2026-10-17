"use client";

import Link from "next/link";
import { useState } from "react";
import { type Day, ddayLabel, initialDay, tripDays } from "@/lib/trip/days";
import { dayChipDate, periodLabel, timeLabel } from "@/lib/trip/format";
import { copyShareLink } from "@/lib/trip/share-link";
import type { ItemSnapshot, TripSnapshot } from "@/lib/trip/snapshot";
import { dayTimeline } from "@/lib/trip/timeline";
import styles from "./trip.module.css";

const DEFAULT_EMOJI = "📍";

/** Day colors cycle through four (visual-design 2.1). */
function dayClass(day: Day): string {
  return `day-${((day.number - 1) % 4) + 1}`;
}

type TripViewProps = {
  trip: TripSnapshot;
  /** `YYYY-MM-DD` in the viewer's local calendar. */
  today: string;
};

/** The trip screen body (spec 7.3): top bar, header, day chips, timeline. */
export function TripView({ trip, today }: TripViewProps) {
  const days = tripDays(trip.start_date, trip.end_date);
  const [picked, setPicked] = useState(() => initialDay(trip.start_date, trip.end_date, today));
  // The period can change under us (later, by someone else); fall back if the day left it.
  const selected = days.find((d) => d.date === picked) ?? days[0];
  const { timed, untimed } = dayTimeline(trip.items, selected.date);

  return (
    <main className={styles.screen}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.iconButton} aria-label="뒤로">
          ←
        </Link>
        <div className={styles.topbarMid}>
          <span className={styles.dday}>{ddayLabel(trip.start_date, trip.end_date, today)}</span>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="공유 링크 복사"
          onClick={() => copyShareLink(window.location.href, navigator.clipboard)}
        >
          🔗
        </button>
      </div>

      <header className={styles.head}>
        <h1 className={styles.title}>{trip.title}</h1>
        <p className={`${styles.period} num`}>{periodLabel(trip.start_date, trip.end_date)}</p>
      </header>

      <ul className={styles.chips} aria-label="일차">
        {days.map((day) => (
          <li key={day.date}>
            <button
              type="button"
              className={`${styles.chip} ${dayClass(day)}`}
              aria-pressed={day.date === selected.date}
              onClick={() => setPicked(day.date)}
            >
              <b>{day.number}일차</b>
              <span className="num">{dayChipDate(day.date)}</span>
            </button>
          </li>
        ))}
      </ul>

      <section key={selected.date} className={dayClass(selected)} aria-label={`${selected.number}일차 일정`}>
        {timed.length === 0 && untimed.length === 0 && (
          <p className={styles.empty}>아직 일정이 없어요.</p>
        )}
        {timed.length > 0 && (
          <ol className={styles.group}>
            {timed.map((item, k) => (
              <TimelineRow key={item.id} item={item} order={k} />
            ))}
          </ol>
        )}
        {untimed.length > 0 && (
          <>
            <h2 className={styles.groupLabel}>시간 미정</h2>
            <ol className={styles.group}>
              {untimed.map((item, k) => (
                <TimelineRow key={item.id} item={item} order={timed.length + k} />
              ))}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}

function TimelineRow({ item, order }: { item: ItemSnapshot; order: number }) {
  const untimed = item.start_time === null;
  return (
    <li className={styles.row}>
      <div className={`${styles.time} num`}>{item.start_time}</div>
      <div className={styles.rail}>
        <span className={untimed ? `${styles.dot} ${styles.dotHollow}` : styles.dot} />
      </div>
      <div>
        <ItemCard item={item} order={order} />
      </div>
    </li>
  );
}

function ItemCard({ item, order }: { item: ItemSnapshot; order: number }) {
  const label = timeLabel(item);
  return (
    <article className={styles.card} style={{ animationDelay: `${order * 60}ms` }}>
      <h3 className={styles.cardTitle}>
        <span className={styles.icon} aria-hidden>
          {item.emoji ?? DEFAULT_EMOJI}
        </span>
        {item.title}
      </h3>
      {label && <p className={`${styles.cardTime} num`}>{label}</p>}
      {item.memo && <p className={styles.memo}>{item.memo}</p>}
    </article>
  );
}
