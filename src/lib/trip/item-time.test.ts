import { describe, expect, it } from "vitest";
import { addMinutes, durationMinutes, overlappingItems } from "./item-time";
import type { ItemSnapshot } from "./snapshot";
import { hhMm, isoDate } from "./test-values";

type Slot = Pick<ItemSnapshot, "id" | "date" | "startTime" | "endTime">;

function slot(id: string, startTime: string | null, endTime: string | null, date = "2026-11-20"): Slot {
  return { id, date: isoDate(date), startTime: startTime === null ? null : hhMm(startTime), endTime: endTime === null ? null : hhMm(endTime) };
}

describe("overlappingItems", () => {
  const items = [
    slot("museum", "14:00", "15:30"),
    slot("cafe", "15:30", "16:00"),
    slot("no-end", "14:30", null),
    slot("untimed", null, null),
    slot("other-day", "14:00", "15:30", "2026-11-21"),
  ];

  it("finds items on the same day whose time ranges overlap", () => {
    expect(overlappingItems(slot("new", "15:00", "15:45"), items).map((i) => i.id)).toEqual(["museum", "cafe"]);
  });

  it("does not count ranges that only touch", () => {
    expect(overlappingItems(slot("new", "13:00", "14:00"), items)).toEqual([]);
    expect(overlappingItems(slot("new", "16:00", "17:00"), items)).toEqual([]);
  });

  it("only compares items that have both a start and an end time", () => {
    expect(overlappingItems(slot("new", "14:30", null), items)).toEqual([]);
    expect(overlappingItems(slot("new", "14:40", "14:50"), items).map((i) => i.id)).toEqual(["museum"]);
  });

  it("skips the item being edited", () => {
    expect(overlappingItems(slot("museum", "14:00", "15:00"), items)).toEqual([]);
  });

  it("reads an end at or before the start as the next day", () => {
    const night = slot("night", "23:00", "02:00");
    const late = [slot("bar", "22:00", "23:30"), slot("ramen", "01:00", "01:30", "2026-11-21"), slot("early", "01:00", "01:30")];
    expect(overlappingItems(night, late).map((i) => i.id)).toEqual(["bar", "ramen"]);
    expect(overlappingItems(slot("next", "00:30", "01:00", "2026-11-21"), [night]).map((i) => i.id)).toEqual(["night"]);
  });
});

describe("durationMinutes", () => {
  it("measures from start to end, crossing midnight when the end is not later", () => {
    expect(durationMinutes(hhMm("09:00"), hhMm("10:30"))).toBe(90);
    expect(durationMinutes(hhMm("20:00"), hhMm("01:00"))).toBe(300);
    expect(durationMinutes(hhMm("09:00"), hhMm("09:00"))).toBe(24 * 60);
  });
});

describe("addMinutes", () => {
  it("wraps past midnight", () => {
    expect(addMinutes(hhMm("09:00"), 90)).toBe("10:30");
    expect(addMinutes(hhMm("23:30"), 60)).toBe("00:30");
  });
});
