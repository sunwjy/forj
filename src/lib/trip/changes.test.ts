import { describe, expect, it } from "vitest";
import { optimisticCreatedAt, rebase } from "./changes";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";
import { hhMm, isoDate } from "./test-values";

function item(overrides: Partial<ItemSnapshot> & Pick<ItemSnapshot, "id">): ItemSnapshot {
  return {
    date: isoDate("2026-11-20"),
    title: overrides.id,
    memo: null,
    startTime: null,
    endTime: null,
    emoji: null,
    createdAt: "2026-10-17T00:00:00.000000Z",
    ...overrides,
  };
}

const lunch = item({ id: "lunch", title: "라멘", startTime: hhMm("12:00"), endTime: hhMm("13:00") });
const dinner = item({ id: "dinner", title: "포장마차", startTime: hhMm("20:00") });

const snapshot: TripSnapshot = {
  title: "후쿠오카",
  startDate: isoDate("2026-11-20"),
  endDate: isoDate("2026-11-22"),
  items: [lunch, dinner],
};

describe("rebase", () => {
  it("is the snapshot itself when nothing is pending", () => {
    expect(rebase(snapshot, [])).toEqual(snapshot);
  });

  it("adds a created item in timeline order", () => {
    const breakfast = item({ id: "breakfast", startTime: hhMm("08:00") });
    expect(rebase(snapshot, [{ kind: "create_item", item: breakfast }]).items).toEqual([
      breakfast,
      lunch,
      dinner,
    ]);
  });

  it("keeps the server's copy when the snapshot already has the created item", () => {
    const optimistic = { ...lunch, title: "낙관적으로 그린 라멘", createdAt: "2026-10-18T00:00:00.000000Z" };
    expect(rebase(snapshot, [{ kind: "create_item", item: optimistic }]).items).toEqual([lunch, dinner]);
  });

  it("applies only the patched fields of an update and re-sorts", () => {
    const view = rebase(snapshot, [
      { kind: "update_item", id: "lunch", patch: { title: "돈코츠 라멘", startTime: hhMm("21:00"), endTime: null } },
    ]);
    expect(view.items).toEqual([
      dinner,
      { ...lunch, title: "돈코츠 라멘", startTime: "21:00", endTime: null },
    ]);
  });

  it("ignores an update or delete for an item the snapshot no longer has", () => {
    expect(
      rebase(snapshot, [
        { kind: "update_item", id: "gone", patch: { title: "x" } },
        { kind: "delete_item", id: "gone" },
      ]),
    ).toEqual(snapshot);
  });

  it("removes a deleted item", () => {
    expect(rebase(snapshot, [{ kind: "delete_item", id: "lunch" }]).items).toEqual([dinner]);
  });

  it("replays changes in the order they were made", () => {
    const snack = item({ id: "snack", title: "간식" });
    const view = rebase(snapshot, [
      { kind: "create_item", item: snack },
      { kind: "update_item", id: "snack", patch: { title: "편의점 간식" } },
      { kind: "update_item", id: "snack", patch: { date: isoDate("2026-11-21") } },
      { kind: "delete_item", id: "dinner" },
    ]);
    expect(view.items).toEqual([lunch, { ...snack, title: "편의점 간식", date: "2026-11-21" }]);
  });

  it("sorts an optimistic item with the server's items by its createdAt", () => {
    const later = item({ id: "zz-later", startTime: hhMm("12:00"), createdAt: optimisticCreatedAt(new Date("2026-10-17T00:00:00.001Z")) });
    const view = rebase(snapshot, [{ kind: "create_item", item: later }]);
    expect(view.items.map((i) => i.id)).toEqual(["lunch", "zz-later", "dinner"]);
  });

  it("leaves the snapshot unchanged", () => {
    const before = structuredClone(snapshot);
    rebase(snapshot, [
      { kind: "update_item", id: "lunch", patch: { title: "바뀜" } },
      { kind: "delete_item", id: "dinner" },
    ]);
    expect(snapshot).toEqual(before);
  });

  it("shows a new trip title", () => {
    expect(rebase(snapshot, [{ kind: "update_trip_title", title: "후쿠오카 먹방" }])).toEqual({
      ...snapshot,
      title: "후쿠오카 먹방",
    });
  });

  it("shows a new period, without the items on dates that left it", () => {
    const lastDay = item({ id: "last", date: isoDate("2026-11-22") });
    const view = rebase({ ...snapshot, items: [lunch, dinner, lastDay] }, [
      { kind: "set_trip_dates", startDate: isoDate("2026-11-19"), endDate: isoDate("2026-11-21"), confirmedDeletedIds: ["last"] },
    ]);
    expect(view).toEqual({ ...snapshot, startDate: "2026-11-19", endDate: "2026-11-21", items: [lunch, dinner] });
  });

  it("replays item changes made after a period change on the new period", () => {
    const view = rebase(snapshot, [
      { kind: "set_trip_dates", startDate: isoDate("2026-11-21"), endDate: isoDate("2026-11-22"), confirmedDeletedIds: ["lunch", "dinner"] },
      { kind: "update_item", id: "lunch", patch: { title: "되살리면 안 됨" } },
    ]);
    expect(view.items).toEqual([]);
  });
});

describe("optimisticCreatedAt", () => {
  it("uses the server's fixed-width UTC format with microseconds", () => {
    expect(optimisticCreatedAt(new Date("2026-10-17T09:05:03.042+09:00"))).toBe("2026-10-17T00:05:03.042000Z");
  });
});
