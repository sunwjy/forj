import { describe, expect, it } from "vitest";
import { periodChange } from "./period-change";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";
import { isoDate } from "./test-values";

function item(id: string, date: string): ItemSnapshot {
  return { id, date: isoDate(date), title: id, memo: null, startTime: null, endTime: null, emoji: null, createdAt: "2026-10-17T00:00:00.000000Z" };
}

// 11.20 – 11.23, sorted as get_trip sorts.
const trip: TripSnapshot = {
  title: "오사카",
  startDate: isoDate("2026-11-20"),
  endDate: isoDate("2026-11-23"),
  items: [item("d1", "2026-11-20"), item("d2", "2026-11-21"), item("d4a", "2026-11-23"), item("d4b", "2026-11-23")],
};

describe("periodChange", () => {
  it("removes nothing when the period grows at both ends", () => {
    expect(periodChange(trip, isoDate("2026-11-18"), isoDate("2026-11-25"))).toEqual({ removedDates: [], deletedItems: [] });
  });

  it("removes nothing when the period stays the same", () => {
    expect(periodChange(trip, isoDate("2026-11-20"), isoDate("2026-11-23"))).toEqual({ removedDates: [], deletedItems: [] });
  });

  it("lists the dates leaving the end and the items on them", () => {
    expect(periodChange(trip, isoDate("2026-11-20"), isoDate("2026-11-22"))).toEqual({
      removedDates: ["2026-11-23"],
      deletedItems: [trip.items[2], trip.items[3]],
    });
  });

  it("lists dates leaving the start, including dates without items", () => {
    expect(periodChange(trip, isoDate("2026-11-22"), isoDate("2026-11-23"))).toEqual({
      removedDates: ["2026-11-20", "2026-11-21"],
      deletedItems: [trip.items[0], trip.items[1]],
    });
  });

  it("lists a removed date with no items, deleting nothing", () => {
    expect(periodChange(trip, isoDate("2026-11-20"), isoDate("2026-11-21"))).toEqual({
      removedDates: ["2026-11-22", "2026-11-23"],
      deletedItems: [trip.items[2], trip.items[3]],
    });
    expect(periodChange({ ...trip, items: [] }, isoDate("2026-11-21"), isoDate("2026-11-23"))).toEqual({
      removedDates: ["2026-11-20"],
      deletedItems: [],
    });
  });

  it("removes every old date when the new period does not overlap the old one", () => {
    expect(periodChange(trip, isoDate("2026-12-01"), isoDate("2026-12-02"))).toEqual({
      removedDates: ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"],
      deletedItems: trip.items,
    });
  });

  it("shifting the period removes dates at one end while adding at the other", () => {
    expect(periodChange(trip, isoDate("2026-11-21"), isoDate("2026-11-24"))).toEqual({
      removedDates: ["2026-11-20"],
      deletedItems: [trip.items[0]],
    });
  });
});
