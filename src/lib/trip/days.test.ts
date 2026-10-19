import { describe, expect, it } from "vitest";
import { ddayLabel, initialDay, tripDays } from "./days";
import { isoDate } from "./test-values";

describe("tripDays", () => {
  it("lists one day per date in the period, numbered from 1", () => {
    expect(tripDays(isoDate("2026-11-20"), isoDate("2026-11-23"))).toEqual([
      { date: "2026-11-20", number: 1 },
      { date: "2026-11-21", number: 2 },
      { date: "2026-11-22", number: 3 },
      { date: "2026-11-23", number: 4 },
    ]);
  });

  it("has a single day when the trip starts and ends on the same date", () => {
    expect(tripDays(isoDate("2026-09-05"), isoDate("2026-09-05"))).toEqual([{ date: isoDate("2026-09-05"), number: 1 }]);
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(tripDays(isoDate("2027-12-31"), isoDate("2028-01-01")).map((d) => d.date)).toEqual([
      "2027-12-31",
      "2028-01-01",
    ]);
    expect(tripDays(isoDate("2028-02-28"), isoDate("2028-03-01")).map((d) => d.date)).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });
});

describe("initialDay", () => {
  it("opens on today while the trip is under way", () => {
    expect(initialDay(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-11-22"))).toBe("2026-11-22");
  });

  it("opens on the first day before or after the trip", () => {
    expect(initialDay(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-10-17"))).toBe("2026-11-20");
    expect(initialDay(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-12-01"))).toBe("2026-11-20");
  });
});

describe("ddayLabel", () => {
  it("counts down to the start date before the trip", () => {
    expect(ddayLabel(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-10-17"))).toBe("D-34");
    expect(ddayLabel(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-11-19"))).toBe("D-1");
  });

  it("names the current day during the trip, including the first and last days", () => {
    expect(ddayLabel(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-11-20"))).toBe("1일차 여행 중");
    expect(ddayLabel(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-11-23"))).toBe("4일차 여행 중");
  });

  it("marks a finished trip after the end date", () => {
    expect(ddayLabel(isoDate("2026-11-20"), isoDate("2026-11-23"), isoDate("2026-11-24"))).toBe("다녀온 여행");
  });
});
