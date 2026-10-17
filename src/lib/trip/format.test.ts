import { describe, expect, it } from "vitest";
import { dayChipDate, localDate, periodLabel, timeLabel } from "./format";

describe("periodLabel", () => {
  it("shows both dates with weekdays and the nights and days", () => {
    expect(periodLabel("2026-11-20", "2026-11-23")).toBe("11.20 (금) – 11.23 (월) · 3박 4일");
  });

  it("calls a one-day trip 당일", () => {
    expect(periodLabel("2026-09-05", "2026-09-05")).toBe("9.05 (토) · 당일");
  });
});

describe("dayChipDate", () => {
  it("shows month.day and the weekday", () => {
    expect(dayChipDate("2026-11-21")).toBe("11.21 토");
  });
});

describe("timeLabel", () => {
  it("shows the start time alone when there is no end time", () => {
    expect(timeLabel({ start_time: "15:00", end_time: null })).toBe("15:00");
  });

  it("shows a range, marking an end on the next day with +1", () => {
    expect(timeLabel({ start_time: "09:00", end_time: "10:30" })).toBe("09:00–10:30");
    expect(timeLabel({ start_time: "20:00", end_time: "01:00" })).toBe("20:00–01:00 +1");
  });

  it("is empty for an untimed item", () => {
    expect(timeLabel({ start_time: null, end_time: null })).toBe("");
  });
});

describe("localDate", () => {
  it("uses the viewer's local calendar date", () => {
    expect(localDate(new Date(2026, 10, 20, 23, 59))).toBe("2026-11-20");
    expect(localDate(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });
});
