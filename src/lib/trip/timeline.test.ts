import { describe, expect, it } from "vitest";
import type { ItemSnapshot } from "./snapshot";
import { dayTimeline, endsNextDay, sortItems } from "./timeline";

function item(over: Partial<ItemSnapshot> & Pick<ItemSnapshot, "id">): ItemSnapshot {
  return {
    date: "2026-11-20",
    title: over.id,
    memo: null,
    start_time: null,
    end_time: null,
    emoji: null,
    created_at: "2026-10-17T00:00:00.000000Z",
    ...over,
  };
}

describe("sortItems", () => {
  it("orders by date, then start time with untimed items last, then creation, then id", () => {
    const items = [
      item({ id: "untimed-late", created_at: "2026-10-17T00:00:02.000000Z" }),
      item({ id: "next-day", date: "2026-11-21", start_time: "08:00" }),
      item({ id: "noon", start_time: "12:00" }),
      item({ id: "untimed-early", created_at: "2026-10-17T00:00:01.000000Z" }),
      item({ id: "morning-b", start_time: "09:00" }),
      item({ id: "morning-later", start_time: "09:00", created_at: "2026-10-17T00:00:00.000001Z" }),
      item({ id: "morning-a", start_time: "09:00" }),
    ];

    expect(sortItems(items).map((i) => i.id)).toEqual([
      "morning-a",
      "morning-b",
      "morning-later",
      "noon",
      "untimed-early",
      "untimed-late",
      "next-day",
    ]);
  });

  it("does not modify the list it is given", () => {
    const items = [item({ id: "b", start_time: "10:00" }), item({ id: "a", start_time: "09:00" })];
    sortItems(items);
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("dayTimeline", () => {
  it("keeps only the day's items, timed ones in order and untimed ones in creation order", () => {
    const items = [
      item({ id: "other-day", date: "2026-11-21", start_time: "07:00" }),
      item({ id: "untimed-2", created_at: "2026-10-17T00:00:02.000000Z" }),
      item({ id: "dinner", start_time: "19:00", end_time: "21:00" }),
      item({ id: "untimed-1", created_at: "2026-10-17T00:00:01.000000Z" }),
      item({ id: "breakfast", start_time: "08:00" }),
    ];

    const { timed, untimed } = dayTimeline(items, "2026-11-20");

    expect(timed.map((i) => i.id)).toEqual(["breakfast", "dinner"]);
    expect(untimed.map((i) => i.id)).toEqual(["untimed-1", "untimed-2"]);
  });

  it("is empty for a day without items", () => {
    expect(dayTimeline([item({ id: "x" })], "2026-11-22")).toEqual({ timed: [], untimed: [] });
  });
});

describe("endsNextDay", () => {
  it("is true when the end time is at or before the start time", () => {
    expect(endsNextDay({ start_time: "20:00", end_time: "01:00" })).toBe(true);
    expect(endsNextDay({ start_time: "09:00", end_time: "09:00" })).toBe(true);
  });

  it("is false when the item ends later the same day or has no end time", () => {
    expect(endsNextDay({ start_time: "09:00", end_time: "10:30" })).toBe(false);
    expect(endsNextDay({ start_time: "09:00", end_time: null })).toBe(false);
    expect(endsNextDay({ start_time: null, end_time: null })).toBe(false);
  });
});
