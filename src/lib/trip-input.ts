/**
 * Client-side checks for a trip's title and period (spec 2.1). The server
 * repeats them in `create_trip`; this only gives the form early feedback.
 */

export const MAX_TITLE_LENGTH = 100;
export const MAX_PERIOD_DAYS = 30;

export type TripDraft = {
  title: string;
  /** `YYYY-MM-DD` from a date input, or "" when not chosen. */
  startDate: string;
  endDate: string;
};

export type TripInput = TripDraft;

export type TripInputResult =
  | { ok: true; value: TripInput }
  | { ok: false; field: "title" | "period"; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from start to end, both included. Uses UTC so local DST never shifts it. */
function periodDays(startDate: string, endDate: string): number {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS + 1;
}

export function validateTripInput(draft: TripDraft): TripInputResult {
  const title = draft.title.trim();
  if (title.length === 0) {
    return { ok: false, field: "title", message: "여행 제목을 입력해 주세요." };
  }
  // Length is counted in code points, like `char_length` on the server (spec 2.3).
  if ([...title].length > MAX_TITLE_LENGTH) {
    return { ok: false, field: "title", message: `여행 제목은 ${MAX_TITLE_LENGTH}자까지 쓸 수 있어요.` };
  }

  const { startDate, endDate } = draft;
  if (!startDate || !endDate) {
    return { ok: false, field: "period", message: "시작일과 종료일을 골라 주세요." };
  }
  const days = periodDays(startDate, endDate);
  if (Number.isNaN(days)) {
    return { ok: false, field: "period", message: "시작일과 종료일을 골라 주세요." };
  }
  if (days < 1) {
    return { ok: false, field: "period", message: "종료일은 시작일보다 앞설 수 없어요." };
  }
  if (days > MAX_PERIOD_DAYS) {
    return { ok: false, field: "period", message: `여행 기간은 최대 ${MAX_PERIOD_DAYS}일이에요.` };
  }

  return { ok: true, value: { title, startDate, endDate } };
}
