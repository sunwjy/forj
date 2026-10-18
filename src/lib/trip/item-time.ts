import { daysBetween } from "./days";
import type { ItemSnapshot } from "./snapshot";

const DAY_MINUTES = 24 * 60;

function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Minutes from start to end. An end at or before the start is the next day,
 * so the result is 1 to 1440 (spec 2.3).
 */
export function durationMinutes(start: string, end: string): number {
  const diff = minutesOf(end) - minutesOf(start);
  return diff > 0 ? diff : diff + DAY_MINUTES;
}

/** `HH:MM` plus `minutes`, wrapping past midnight. */
export function addMinutes(time: string, minutes: number): string {
  const total = (((minutesOf(time) + minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

type Slot = Pick<ItemSnapshot, "id" | "date" | "start_time" | "end_time">;

/** [start, end) in minutes from a fixed date, or undefined without both times. */
function span(item: Slot, origin: string): [number, number] | undefined {
  if (item.start_time === null || item.end_time === null) return undefined;
  const start = daysBetween(origin, item.date) * DAY_MINUTES + minutesOf(item.start_time);
  return [start, start + durationMinutes(item.start_time, item.end_time)];
}

/**
 * The other items whose time ranges overlap `target` (spec 2.5). Only items
 * with both a start and an end time take part; ranges that only touch do not
 * overlap. Overnight items reach into the next day.
 */
export function overlappingItems<T extends Slot>(target: Slot, items: readonly T[]): T[] {
  const mine = span(target, target.date);
  if (!mine) return [];
  return items.filter((item) => {
    if (item.id === target.id) return false;
    const theirs = span(item, target.date);
    return theirs !== undefined && theirs[0] < mine[1] && mine[0] < theirs[1];
  });
}
