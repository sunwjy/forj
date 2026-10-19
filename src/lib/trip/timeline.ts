import type { IsoDate } from "./branded";
import type { ItemSnapshot } from "./snapshot";

type Sortable = Pick<ItemSnapshot, "id" | "date" | "startTime" | "createdAt">;

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The one ordering shared by server and client:
 * `date, startTime nulls last, createdAt, id` (spec 2.4).
 * Every field is a fixed-width string, so string order is value order.
 */
export function compareItems(a: Sortable, b: Sortable): number {
  if (a.date !== b.date) return compareText(a.date, b.date);
  if (a.startTime !== b.startTime) {
    if (a.startTime === null) return 1;
    if (b.startTime === null) return -1;
    return compareText(a.startTime, b.startTime);
  }
  if (a.createdAt !== b.createdAt) return compareText(a.createdAt, b.createdAt);
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
export function dayTimeline<T extends Sortable>(items: readonly T[], date: IsoDate): DayTimeline<T> {
  const ofDay = sortItems(items.filter((i) => i.date === date));
  return {
    timed: ofDay.filter((i) => i.startTime !== null),
    untimed: ofDay.filter((i) => i.startTime === null),
  };
}

/**
 * An end time at or before the start time is read as the next day and shown
 * with "+1" (spec 2.3).
 */
export function endsNextDay(item: Pick<ItemSnapshot, "startTime" | "endTime">): boolean {
  return item.startTime !== null && item.endTime !== null && item.endTime <= item.startTime;
}
