import { describe, expect, it } from "vitest";
import { parseHhMm, parseIsoDate, parseShareToken } from "./branded";
import { daysBetween } from "./days";
import { addMinutes } from "./item-time";
import type { RecentTrip } from "./recent-trips";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";

describe("parseIsoDate", () => {
  it("accepts a real YYYY-MM-DD date as the same string", () => {
    expect(parseIsoDate("2026-11-20")).toBe("2026-11-20");
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29");
  });

  it("rejects other formats", () => {
    for (const s of ["", "2026-1-20", "2026/11/20", "20261120", "2026-11-20T00:00", " 2026-11-20", "abcd-ef-gh"]) {
      expect(parseIsoDate(s)).toBeNull();
    }
  });

  it("rejects dates that do not exist", () => {
    for (const s of ["2026-02-30", "2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2026-11-00"]) {
      expect(parseIsoDate(s)).toBeNull();
    }
  });
});

describe("parseHhMm", () => {
  it("accepts HH:MM from 00:00 to 23:59 as the same string", () => {
    for (const s of ["00:00", "09:05", "23:59"]) expect(parseHhMm(s)).toBe(s);
  });

  it("rejects other formats and out-of-range times", () => {
    for (const s of ["", "9:05", "09:5", "0905", "09:05:00", "24:00", "12:60", "ab:cd", " 09:05"]) {
      expect(parseHhMm(s)).toBeNull();
    }
  });
});

describe("parseShareToken", () => {
  it("accepts a 22-character base64url token as the same string", () => {
    for (const s of ["devExampleTrip00000000", "AbCd-_0123456789xyzXYZ"]) expect(parseShareToken(s)).toBe(s);
  });

  it("rejects other shapes", () => {
    const bad = ["", "short", "devExampleTrip0000000", "devExampleTrip000000000", "devExampleTrip0000000=", "devExampleTrip/0000000"];
    for (const s of bad) expect(parseShareToken(s)).toBeNull();
  });
});

// Type-level checks, enforced by `pnpm typecheck` (tsc covers test files): a
// plain string must go through a parser before it can stand in for a date,
// time or share token.
describe("branded types", () => {
  it("reject unvalidated strings at compile time", () => {
    const raw: string = "2026-11-20";
    const date = parseIsoDate("2026-11-20")!;
    const time = parseHhMm("12:00")!;
    const token = parseShareToken("devExampleTrip00000000")!;

    // @ts-expect-error a plain string is not an IsoDate
    const trip: TripSnapshot = { title: "후쿠오카", startDate: raw, endDate: date, items: [] };
    const item: ItemSnapshot = {
      id: "00000000-0000-4000-8000-000000000999",
      // @ts-expect-error a plain string is not an IsoDate
      date: raw,
      title: "라멘",
      memo: null,
      // @ts-expect-error a plain string is not an HhMm
      startTime: raw,
      endTime: time,
      emoji: null,
      createdAt: "2026-10-17T00:00:00.000000Z",
    };
    // @ts-expect-error a plain string is not a ShareToken
    const recent: RecentTrip = { token: raw, title: "후쿠오카", startDate: date, endDate: date, openedAt: 0 };
    const branded: RecentTrip = { token, title: "후쿠오카", startDate: date, endDate: date, openedAt: 0 };

    // @ts-expect-error daysBetween takes IsoDates
    daysBetween(raw, date);
    // @ts-expect-error addMinutes takes an HhMm
    addMinutes(raw, 30);

    expect([trip, item, recent, branded]).toHaveLength(4);
    expect(daysBetween(date, date)).toBe(0);
    expect(addMinutes(time, 30)).toBe("12:30");
  });
});
