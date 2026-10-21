/**
 * Days (일차) are computed from a trip's period and never stored (spec 2.2).
 * Dates are ISO `YYYY-MM-DD` strings in the trip's local calendar; the math
 * runs in UTC so no timezone or DST shift can move a date.
 */

import { parseIsoDate, type IsoDate } from "./branded";

export type Day = {
  date: IsoDate;
  /** 1-based: "1일차" is the start date. */
  number: number;
};

const MS_PER_DAY = 86_400_000;

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): IsoDate {
  // A UTC midnight always prints as a real date, so this never gives null.
  return parseIsoDate(new Date(ms).toISOString().slice(0, 10))!;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** The day selected when the trip screen opens: today during the trip, else day 1. */
export function initialDay(startDate: IsoDate, endDate: IsoDate, today: IsoDate): IsoDate {
  return startDate <= today && today <= endDate ? today : startDate;
}

/**
 * The badge in the trip screen's top bar (spec 7.3), relative to `today`
 * in the viewer's local calendar.
 */
export function ddayLabel(startDate: IsoDate, endDate: IsoDate, today: IsoDate): string {
  if (today < startDate) return `D-${daysBetween(today, startDate)}`;
  if (today <= endDate) return `${daysBetween(startDate, today) + 1}일차 여행 중`;
  return "다녀온 여행";
}

/** One day per date from `startDate` to `endDate`, inclusive. */
export function tripDays(startDate: IsoDate, endDate: IsoDate): Day[] {
  const start = toUtc(startDate);
  const count = daysBetween(startDate, endDate) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) => ({
    date: fromUtc(start + i * MS_PER_DAY),
    number: i + 1,
  }));
}
