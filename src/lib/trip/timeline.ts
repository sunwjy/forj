import type { ItemSnapshot } from "./snapshot";

type Sortable = Pick<ItemSnapshot, "id" | "date" | "start_time" | "created_at">;

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The one ordering shared by server and client:
 * `date, start_time nulls last, created_at, id` (spec 2.4).
 * Every field is a fixed-width string, so string order is value order.
 */
export function compareItems(a: Sortable, b: Sortable): number {
  if (a.date !== b.date) return compareText(a.date, b.date);
  if (a.start_time !== b.start_time) {
    if (a.start_time === null) return 1;
    if (b.start_time === null) return -1;
    return compareText(a.start_time, b.start_time);
  }
  if (a.created_at !== b.created_at) return compareText(a.created_at, b.created_at);
  return compareText(a.id, b.id);
}

/** A sorted copy; the input is left as it was. */
export function sortItems<T extends Sortable>(items: readonly T[]): T[] {
  return [...items].sort(compareItems);
}

export type DayTimeline<T> = {
  /** Items with a start time, in timeline order. */
  timed: T[];
  /** The "시간 미정" group at the bottom of the day, in creation order (spec 2.4). */
  untimed: T[];
};

/** One day's items, split into the timeline and the "시간 미정" group. */
export function dayTimeline<T extends Sortable>(items: readonly T[], date: string): DayTimeline<T> {
  const ofDay = sortItems(items.filter((i) => i.date === date));
  return {
    timed: ofDay.filter((i) => i.start_time !== null),
    untimed: ofDay.filter((i) => i.start_time === null),
  };
}

/**
 * An end time at or before the start time is read as the next day and shown
 * with "+1" (spec 2.3).
 */
export function endsNextDay(item: Pick<ItemSnapshot, "start_time" | "end_time">): boolean {
  return item.start_time !== null && item.end_time !== null && item.end_time <= item.start_time;
}
