import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TripChange } from "./changes";
import type { FetchTripResult } from "./fetch-trip";
import type { SendOutcome } from "./send-change";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";
import { createTripStore, STALL_AFTER_MS, type Rejection } from "./trip-store";
import { isoDate } from "./test-values";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A fake server: every fetch and send waits until the test answers it. */
function fakeServer() {
  const fetches: ReturnType<typeof deferred<FetchTripResult>>[] = [];
  const sends: { change: TripChange; answer: ReturnType<typeof deferred<SendOutcome>> }[] = [];
  const store = createTripStore({
    fetchSnapshot: () => {
      const d = deferred<FetchTripResult>();
      fetches.push(d);
      return d.promise;
    },
    send: (change) => {
      const answer = deferred<SendOutcome>();
      sends.push({ change, answer });
      return answer.promise;
    },
  });
  const rejections: Rejection[] = [];
  store.onRejected((r) => rejections.push(r));
  return { store, fetches, sends, rejections };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

function item(id: string, overrides: Partial<ItemSnapshot> = {}): ItemSnapshot {
  return {
    id,
    date: isoDate("2026-11-20"),
    title: id,
    memo: null,
    startTime: null,
    endTime: null,
    emoji: null,
    createdAt: "2026-10-17T00:00:00.000000Z",
    ...overrides,
  };
}

function trip(items: ItemSnapshot[]): TripSnapshot {
  return { title: "후쿠오카", startDate: isoDate("2026-11-20"), endDate: isoDate("2026-11-22"), items };
}

function shownTitles(store: ReturnType<typeof createTripStore>): string[] {
  const { trip } = store.getState();
  if (trip.status !== "found" && trip.status !== "error") return [];
  return trip.trip?.items.map((i) => i.title) ?? [];
}

/** A store that has loaded `items`. */
async function loaded(items: ItemSnapshot[]) {
  const server = fakeServer();
  server.store.reload();
  server.fetches[0].resolve({ status: "found", trip: trip(items) });
  await flush();
  return server;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("trip store", () => {
  it("is loading until the first snapshot arrives", async () => {
    const { store, fetches } = fakeServer();
    store.reload();
    expect(store.getState().trip).toEqual({ status: "loading" });
    fetches[0].resolve({ status: "found", trip: trip([item("a")]) });
    await flush();
    expect(store.getState().trip).toEqual({ status: "found", trip: trip([item("a")]) });
  });

  it("applies only the newest of overlapping reloads", async () => {
    const { store, fetches } = fakeServer();
    store.reload();
    store.reload();
    fetches[1].resolve({ status: "found", trip: trip([item("new")]) });
    fetches[0].resolve({ status: "found", trip: trip([item("old")]) });
    await flush();
    expect(shownTitles(store)).toEqual(["new"]);
  });

  it("shows a change right away, before the server answers", async () => {
    const { store, sends } = await loaded([item("a")]);
    store.submit({ kind: "update_item", id: "a", patch: { title: "바뀜" } });
    expect(shownTitles(store)).toEqual(["바뀜"]);
    expect(store.getState().pendingCount).toBe(1);
    expect(sends).toHaveLength(1);
  });

  it("sends changes one at a time, in the order they were made", async () => {
    const { store, sends } = await loaded([item("a")]);
    store.submit({ kind: "update_item", id: "a", patch: { title: "1" } });
    store.submit({ kind: "update_item", id: "a", patch: { title: "2" } });
    await flush();
    expect(sends.map((s) => s.change)).toEqual([{ kind: "update_item", id: "a", patch: { title: "1" } }]);

    sends[0].answer.resolve({ kind: "ok" });
    await flush();
    expect(sends.map((s) => s.change)).toEqual([
      { kind: "update_item", id: "a", patch: { title: "1" } },
      { kind: "update_item", id: "a", patch: { title: "2" } },
    ]);
  });

  it("keeps a sent change until a snapshot requested after its success arrives", async () => {
    const { store, sends, fetches } = await loaded([item("a")]);
    store.reload(); // requested before the change succeeds
    store.submit({ kind: "update_item", id: "a", patch: { title: "바뀜" } });
    sends[0].answer.resolve({ kind: "ok" });
    await flush();
    expect(fetches).toHaveLength(3); // the store refetches after its own write

    // The older request is superseded and cannot clear the queue.
    fetches[1].resolve({ status: "found", trip: trip([item("a")]) });
    await flush();
    expect(shownTitles(store)).toEqual(["바뀜"]);
    expect(store.getState().pendingCount).toBe(1);

    fetches[2].resolve({ status: "found", trip: trip([item("a", { title: "바뀜" })]) });
    await flush();
    expect(shownTitles(store)).toEqual(["바뀜"]);
    expect(store.getState().pendingCount).toBe(0);
  });

  it("keeps changes that have not succeeded when a snapshot arrives", async () => {
    const { store, fetches } = await loaded([item("a")]);
    store.submit({ kind: "create_item", item: item("b") });
    store.reload();
    fetches[1].resolve({ status: "found", trip: trip([item("a", { title: "남이 바꿈" })]) });
    await flush();
    expect(shownTitles(store)).toEqual(["남이 바꿈", "b"]);
    expect(store.getState().pendingCount).toBe(1);
  });

  it("retries a change after network errors with growing delays, without reverting it", async () => {
    const { store, sends } = await loaded([item("a")]);
    store.submit({ kind: "delete_item", id: "a" });
    sends[0].answer.resolve({ kind: "retry" });
    await flush();
    expect(shownTitles(store)).toEqual([]);

    await vi.advanceTimersByTimeAsync(999);
    expect(sends).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sends).toHaveLength(2);

    sends[1].answer.resolve({ kind: "retry" });
    await flush();
    await vi.advanceTimersByTimeAsync(1999);
    expect(sends).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sends).toHaveLength(3);
    expect(sends[2].change).toEqual({ kind: "delete_item", id: "a" });
  });

  it("treats a send that throws like a network error", async () => {
    const { store, sends } = await loaded([item("a")]);
    store.submit({ kind: "delete_item", id: "a" });
    sends[0].answer.reject(new Error("boom"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(sends).toHaveLength(2);
  });

  it("marks the store stalled when a change cannot be sent for a few seconds", async () => {
    const { store, sends } = await loaded([item("a")]);
    store.submit({ kind: "delete_item", id: "a" });
    sends[0].answer.resolve({ kind: "retry" });
    await flush();
    await vi.advanceTimersByTimeAsync(STALL_AFTER_MS - 1);
    expect(store.getState().stalled).toBe(false);
    for (const s of sends) s.answer.resolve({ kind: "retry" });
    await vi.advanceTimersByTimeAsync(1);
    expect(store.getState().stalled).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);
    sends.at(-1)!.answer.resolve({ kind: "ok" });
    await flush();
    expect(store.getState().stalled).toBe(false);
  });

  it("retries right away when reloaded during a back-off", async () => {
    const { store, sends } = await loaded([item("a")]);
    store.submit({ kind: "delete_item", id: "a" });
    sends[0].answer.resolve({ kind: "retry" });
    await flush();
    store.reload();
    await flush();
    expect(sends).toHaveLength(2);
  });

  it("reverts a rejected change, reports it, and moves on to the next one", async () => {
    const { store, sends, rejections } = await loaded([item("a")]);
    const created = item("b", { date: isoDate("2026-11-30") });
    store.submit({ kind: "create_item", item: created });
    store.submit({ kind: "update_item", id: "a", patch: { title: "바뀜" } });
    expect(shownTitles(store)).toEqual(["바뀜", "b"]);

    sends[0].answer.resolve({ kind: "rejected", code: "DATE_OUT_OF_RANGE" });
    await flush();
    expect(shownTitles(store)).toEqual(["바뀜"]);
    expect(rejections).toEqual([{ change: { kind: "create_item", item: created }, code: "DATE_OUT_OF_RANGE", item: created }]);
    expect(sends[1].change).toEqual({ kind: "update_item", id: "a", patch: { title: "바뀜" } });
  });

  it("reports a rejected update with the item as it was edited, even if it is gone", async () => {
    const { store, sends, rejections, fetches } = await loaded([item("a", { memo: "메모" })]);
    store.submit({ kind: "update_item", id: "a", patch: { title: "바뀜" } });
    store.reload();
    fetches[1].resolve({ status: "found", trip: trip([]) }); // someone deleted it
    await flush();
    sends[0].answer.resolve({ kind: "rejected", code: "ITEM_NOT_FOUND" });
    await flush();
    expect(rejections).toEqual([
      {
        change: { kind: "update_item", id: "a", patch: { title: "바뀜" } },
        code: "ITEM_NOT_FOUND",
        item: item("a", { memo: "메모", title: "바뀜" }),
      },
    ]);
  });

  it("restores the period and its items when a period change is rejected", async () => {
    const { store, sends, rejections } = await loaded([item("a"), item("b", { date: isoDate("2026-11-22") })]);
    const change: TripChange = { kind: "set_trip_dates", startDate: isoDate("2026-11-20"), endDate: isoDate("2026-11-21"), confirmedDeletedIds: ["b"] };
    store.submit(change);
    expect(store.getState().trip).toMatchObject({ trip: { endDate: "2026-11-21" } });
    expect(shownTitles(store)).toEqual(["a"]);

    sends[0].answer.resolve({ kind: "rejected", code: "DELETION_MISMATCH" });
    await flush();
    expect(store.getState().trip).toMatchObject({ trip: { endDate: "2026-11-22" } });
    expect(shownTitles(store)).toEqual(["a", "b"]);
    expect(rejections).toEqual([{ change, code: "DELETION_MISMATCH", item: undefined }]);
  });

  it("drops the queue and shows not found when the trip disappears while sending", async () => {
    const { store, sends, rejections } = await loaded([item("a")]);
    store.submit({ kind: "delete_item", id: "a" });
    store.submit({ kind: "create_item", item: item("b") });
    sends[0].answer.resolve({ kind: "rejected", code: "TRIP_NOT_FOUND" });
    await flush();
    expect(store.getState()).toEqual({ trip: { status: "not_found" }, pendingCount: 0, stalled: false });
    expect(rejections).toEqual([]);
    expect(sends).toHaveLength(1);
  });

  it("drops the queue when a refetch finds the trip gone", async () => {
    const { store, fetches } = await loaded([item("a")]);
    store.submit({ kind: "delete_item", id: "a" });
    store.reload();
    fetches[1].resolve({ status: "not_found" });
    await flush();
    expect(store.getState()).toEqual({ trip: { status: "not_found" }, pendingCount: 0, stalled: false });
  });

  it("keeps the last view when a refetch fails, and refetches again while a success awaits its snapshot", async () => {
    const { store, sends, fetches } = await loaded([item("a")]);
    store.submit({ kind: "update_item", id: "a", patch: { title: "바뀜" } });
    sends[0].answer.resolve({ kind: "ok" });
    await flush();
    fetches[1].reject(new Error("offline"));
    await flush();
    expect(store.getState().trip.status).toBe("error");
    expect(shownTitles(store)).toEqual(["바뀜"]);

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetches).toHaveLength(3);
    fetches[2].resolve({ status: "found", trip: trip([item("a", { title: "바뀜" })]) });
    await flush();
    expect(store.getState().trip.status).toBe("found");
    expect(store.getState().pendingCount).toBe(0);
  });

  it("ignores changes before the trip has loaded", async () => {
    const { store, sends } = fakeServer();
    store.reload();
    store.submit({ kind: "delete_item", id: "a" });
    await flush();
    expect(sends).toHaveLength(0);
    expect(store.getState().pendingCount).toBe(0);
  });

  it("notifies subscribers with a new state object only when something changed", async () => {
    const { store } = await loaded([item("a")]);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getState();
    expect(store.getState()).toBe(before);
    store.submit({ kind: "delete_item", id: "a" });
    expect(listener).toHaveBeenCalled();
    expect(store.getState()).not.toBe(before);
  });
});
