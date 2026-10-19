/**
 * Client-side checks for a trip's title and period (spec 2.1). The server
 * repeats them in `create_trip`; this only gives the form early feedback.
 */

import { parseIsoDate, type IsoDate } from "./branded";
import { daysBetween } from "./days";

export const MAX_TITLE_LENGTH = 100;
export const MAX_PERIOD_DAYS = 30;

/** A trip's start and end dates, both included. */
export type Period = { startDate: IsoDate; endDate: IsoDate };

/** A trip's title and period as typed: `YYYY-MM-DD`, or "" when not chosen. */
export type TripDraft = { title: string; startDate: string; endDate: string };

/** A draft that passed `validateTripInput`. */
export type TripInput = { title: string } & Period;

export type TripInputResult =
  | { ok: true; value: TripInput }
  | { ok: false; field: "title" | "period"; message: string };

export function validateTripInput(draft: TripDraft): TripInputResult {
  const title = draft.title.trim();
  if (title.length === 0) {
    return { ok: false, field: "title", message: "여행 제목을 입력해 주세요." };
  }
  // Length is counted in code points, like `char_length` on the server (spec 2.3).
  if ([...title].length > MAX_TITLE_LENGTH) {
    return { ok: false, field: "title", message: `여행 제목은 ${MAX_TITLE_LENGTH}자까지 쓸 수 있어요.` };
  }

  const startDate = parseIsoDate(draft.startDate);
  const endDate = parseIsoDate(draft.endDate);
  if (!startDate || !endDate) {
    return { ok: false, field: "period", message: "시작일과 종료일을 골라 주세요." };
  }
  const days = daysBetween(startDate, endDate) + 1;
  if (days < 1) {
    return { ok: false, field: "period", message: "종료일은 시작일보다 앞설 수 없어요." };
  }
  if (days > MAX_PERIOD_DAYS) {
    return { ok: false, field: "period", message: `여행 기간은 최대 ${MAX_PERIOD_DAYS}일이에요.` };
  }

  return { ok: true, value: { title, startDate, endDate } };
}
