"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { showToast } from "@/components/toast";
import { optimisticCreatedAt } from "@/lib/trip/changes";
import { type Day, ddayLabel, initialDay, tripDays } from "@/lib/trip/days";
import { dayChipDate, periodLabel, timeLabel } from "@/lib/trip/format";
import { blankDraft, draftFromItem, itemFields, type ItemDraft } from "@/lib/trip/item-draft";
import type { ItemSnapshot, TripSnapshot } from "@/lib/trip/snapshot";
import { dayTimeline } from "@/lib/trip/timeline";
import type { Rejection } from "@/lib/trip/trip-store";
import type { TripWriter } from "@/lib/trip/use-trip";
import { ItemSheet, type ItemSheetTarget } from "./ItemSheet";
import styles from "./trip.module.css";

const DEFAULT_EMOJI = "📍";

/** Day colors cycle through four (visual-design 2.1). */
function dayClass(day: Day): string {
  return `day-${((day.number - 1) % 4) + 1}`;
}

type TripViewProps = {
  /** The rebased view: server snapshot plus pending changes. */
  trip: TripSnapshot;
  /** `YYYY-MM-DD` in the viewer's local calendar. */
  today: string;
  writer: TripWriter;
  /** Changes have failed to send for a while (spec 6.3, 7.7). */
  stalled?: boolean;
};

const OUT_OF_RANGE_TOAST = "여행 기간에서 빠진 날짜예요";
const DELETED_TOAST = "삭제된 일정이라 저장하지 못했어요";
const FAILED_TOAST = "저장하지 못했어요";

/** The trip screen body (spec 7.3): top bar, header, day chips, timeline, item sheet. */
export function TripView({ trip, today, writer, stalled = false }: TripViewProps) {
  const days = tripDays(trip.start_date, trip.end_date);
  const [picked, setPicked] = useState(() => initialDay(trip.start_date, trip.end_date, today));
  // The period can change under us (later, by someone else); fall back if the day left it.
  const selected = days.find((d) => d.date === picked) ?? days[0];
  const { timed, untimed } = dayTimeline(trip.items, selected.date);

  const [sheet, setSheet] = useState<ItemSheetTarget | null>(null);
  const sheetKey = useRef(0);

  /** Keeps a draft's date if it is still in the trip; otherwise uses the selected day. */
  const inTrip = (draft: ItemDraft): ItemDraft =>
    days.some((d) => d.date === draft.date) ? draft : { ...draft, date: selected.date };

  function openNew(draft: ItemDraft) {
    setSheet({ key: ++sheetKey.current, mode: "new", draft: inTrip(draft) });
  }

  function openEdit(item: ItemSnapshot, draft: ItemDraft = draftFromItem(item)) {
    setSheet({ key: ++sheetKey.current, mode: "edit", id: item.id, base: itemFields(item), draft: inTrip(draft) });
  }

  // The store has already reverted a rejected change; say so and offer the input back (spec 6.5).
  const handleRejection = useEffectEvent(({ change, code, item }: Rejection) => {
    const current = change.kind === "create_item" ? undefined : trip.items.find((i) => i.id === change.id);
    const draft = item && draftFromItem(item);
    const editAgain = () => {
      if (current) openEdit(current, draft);
      else if (draft) openNew(draft);
    };

    if (code === "ITEM_NOT_FOUND") {
      showToast(DELETED_TOAST, draft ? [{ label: "새 일정으로 추가", onClick: () => openNew(draft) }] : []);
    } else if (code === "DATE_OUT_OF_RANGE") {
      showToast(OUT_OF_RANGE_TOAST, current || draft ? [{ label: "다시 편집", onClick: editAgain }] : []);
    } else {
      showToast(FAILED_TOAST, current ? [{ label: "다시 편집", onClick: editAgain }] : []);
    }
  });

  useEffect(() => writer.onRejected(handleRejection), [writer]);

  return (
    <main className={styles.screen}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.iconButton} aria-label="뒤로">
          ←
        </Link>
        <div className={styles.topbarMid}>
          {stalled ? (
            <span className={styles.offline} role="status">
              연결 끊김 · 다시 연결하는 중
            </span>
          ) : (
            <span className={styles.dday}>{ddayLabel(trip.start_date, trip.end_date, today)}</span>
          )}
        </div>
        {/* Copying the share link arrives with spec 7.5. */}
        <button type="button" className={styles.iconButton} aria-label="공유 링크 복사" disabled>
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
              <TimelineRow key={item.id} item={item} order={k} onOpen={() => openEdit(item)} />
            ))}
          </ol>
        )}
        {untimed.length > 0 && (
          <>
            <h2 className={styles.groupLabel}>시간 미정</h2>
            <ol className={styles.group}>
              {untimed.map((item, k) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  order={timed.length + k}
                  onOpen={() => openEdit(item)}
                />
              ))}
            </ol>
          </>
        )}
      </section>

      <button type="button" className={styles.fab} onClick={() => openNew(blankDraft(selected.date))}>
        ＋ 일정 추가
      </button>

      <ItemSheet
        target={sheet}
        days={days}
        items={trip.items}
        onClose={() => setSheet(null)}
        onCreate={(fields) => {
          writer.submit({
            kind: "create_item",
            item: { ...fields, id: crypto.randomUUID(), created_at: optimisticCreatedAt(new Date()) },
          });
          setPicked(fields.date);
        }}
        onUpdate={(id, patch) => {
          writer.submit({ kind: "update_item", id, patch });
          if (patch.date) setPicked(patch.date);
        }}
        onDelete={(id) => writer.submit({ kind: "delete_item", id })}
        onReAdd={openNew}
      />
    </main>
  );
}

type RowProps = { item: ItemSnapshot; order: number; onOpen: () => void };

function TimelineRow({ item, order, onOpen }: RowProps) {
  const untimed = item.start_time === null;
  return (
    <li className={styles.row}>
      <div className={`${styles.time} num`}>{item.start_time}</div>
      <div className={styles.rail}>
        <span className={untimed ? `${styles.dot} ${styles.dotHollow}` : styles.dot} />
      </div>
      <div>
        <ItemCard item={item} order={order} onOpen={onOpen} />
      </div>
    </li>
  );
}

/** Tapping a card opens it in the item sheet (spec 7.4). */
function ItemCard({ item, order, onOpen }: RowProps) {
  const label = timeLabel(item);
  return (
    <button type="button" className={styles.card} style={{ animationDelay: `${order * 60}ms` }} onClick={onOpen}>
      <span className={styles.cardTitle}>
        <span className={styles.icon} aria-hidden>
          {item.emoji ?? DEFAULT_EMOJI}
        </span>
        {item.title}
      </span>
      {label && <span className={`${styles.cardTime} num`}>{label}</span>}
      {item.memo && <span className={styles.memo}>{item.memo}</span>}
    </button>
  );
}
