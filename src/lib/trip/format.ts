import { parseIsoDate, type IsoDate } from "./branded";
import { daysBetween } from "./days";
import type { ItemSnapshot } from "./snapshot";
import { endsNextDay } from "./timeline";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function monthDay(date: IsoDate): string {
  return `${Number(date.slice(5, 7))}.${date.slice(8, 10)}`;
}

function weekday(date: IsoDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "11.20 (금) – 11.23 (월) · 3박 4일", or "9.05 (토) · 당일". */
export function periodLabel(startDate: IsoDate, endDate: IsoDate): string {
  const nights = daysBetween(startDate, endDate);
  const start = `${monthDay(startDate)} (${weekday(startDate)})`;
  if (nights === 0) return `${start} · 당일`;
  return `${start} – ${monthDay(endDate)} (${weekday(endDate)}) · ${nights}박 ${nights + 1}일`;
}

/** The date line under "N일차" on a day chip: "11.21 토". */
export function dayChipDate(date: IsoDate): string {
  return `${monthDay(date)} ${weekday(date)}`;
}

/** "09:00", "09:00–10:30", or "20:00–01:00 +1"; empty when untimed. */
export function timeLabel(item: Pick<ItemSnapshot, "startTime" | "endTime">): string {
  if (item.startTime === null) return "";
  if (item.endTime === null) return item.startTime;
  return `${item.startTime}–${item.endTime}${endsNextDay(item) ? " +1" : ""}`;
}

/** `YYYY-MM-DD` of `now` in the viewer's local timezone. */
export function localDate(now: Date): IsoDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  // A Date's own fields always form a real date, so this never gives null.
  return parseIsoDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)!;
}
