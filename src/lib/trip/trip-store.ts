/**
 * A trip's local state: the server snapshot plus the queue of pending changes
 * (spec 6.2, ADR 0003). Every write in the app goes through `submit`.
 *
 * - The view is the snapshot with the queue replayed on top (`rebase`).
 * - Changes are sent one at a time, in the order they were made (spec 6.3).
 * - Network errors and timeouts are retried with growing delays; the change
 *   stays on screen. After a few seconds of failing, `stalled` turns on.
 * - A change the server rejects is dropped (so the view reverts) and reported
 *   to `onRejected` listeners (spec 6.5). `TRIP_NOT_FOUND` drops the whole queue.
 * - A change that succeeded leaves the queue only when a snapshot requested
 *   after the success arrives. The store requests that snapshot itself.
 *
 * Framework-free so it can be tested with fake timers; `useTrip` binds it to React.
 */

import { changeDefinition, rebase, type TripChange } from "./changes";
import type { FetchTripResult } from "./fetch-trip";
import type { SendOutcome } from "./send-change";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";

export type TripState =
  | { status: "loading" }
  | { status: "found"; trip: TripSnapshot }
  | { status: "not_found" }
  /** The last load failed; `trip` is the last view, if there ever was one. */
  | { status: "error"; trip?: TripSnapshot };

export type TripStoreState = {
  /** `trip` is the rebased view, not the raw snapshot. */
  trip: TripState;
  /** Changes not yet confirmed by a snapshot. Non-zero means unsaved work (beforeunload). */
  pendingCount: number;
  /** A change has failed to send for `STALL_AFTER_MS` or longer. */
  stalled: boolean;
};

export type Rejection = {
  change: TripChange;
  /** The RPC error code (spec 5.5), or `UNKNOWN`. Never `TRIP_NOT_FOUND`. */
  code: string;
  /**
   * The item as it looked right after the change was made, so the input can be
   * reopened (「다시 편집」, 「새 일정으로 추가」). For a delete, the item before it.
   */
  item?: ItemSnapshot;
};

export type TripStoreDeps = {
  fetchSnapshot: () => Promise<FetchTripResult>;
  send: (change: TripChange) => Promise<SendOutcome>;
};

export type TripStore = {
  getState: () => TripStoreState;
  subscribe: (listener: () => void) => () => void;
  /**
   * Refetches the snapshot; only the newest request's answer is applied
   * (spec 6.4). Also retries a waiting change right away, so callers can use
   * it for realtime signals, reconnects, `visibilitychange` and `online`.
   */
  reload: () => void;
  /** Applies a change optimistically and queues it for sending. Ignored until the trip has loaded. */
  submit: (change: TripChange) => void;
  onRejected: (listener: (rejection: Rejection) => void) => () => void;
  /** Cancels pending timers (on unmount). `reload` starts things again. */
  stop: () => void;
};

export const STALL_AFTER_MS = 5000;
const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
const REFETCH_RETRY_MS = 2000;

type Entry = {
  change: TripChange;
  item?: ItemSnapshot;
  /** Set on success: the last fetch request number issued before it. */
  ackedAfterFetch?: number;
};

export function createTripStore({ fetchSnapshot, send }: TripStoreDeps): TripStore {
  let status: TripState["status"] = "loading";
  let snapshot: TripSnapshot | undefined;
  let queue: Entry[] = [];
  let fetchSeq = 0;
  let sending = false;
  let retryDelay = FIRST_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let refetchTimer: ReturnType<typeof setTimeout> | undefined;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let stalled = false;
  let state: TripStoreState = { trip: { status: "loading" }, pendingCount: 0, stalled: false };
  const listeners = new Set<() => void>();
  const rejectionListeners = new Set<(rejection: Rejection) => void>();

  function view(): TripSnapshot | undefined {
    return snapshot && rebase(snapshot, queue.map((e) => e.change));
  }

  function publish() {
    const trip = view();
    let tripState: TripState;
    if (status === "found" && trip) tripState = { status, trip };
    else if (status === "error") tripState = trip ? { status, trip } : { status };
    else if (status === "not_found") tripState = { status };
    else tripState = { status: "loading" };
    state = { trip: tripState, pendingCount: queue.length, stalled };
    for (const listener of listeners) listener();
  }

  function clearTimer(timer: ReturnType<typeof setTimeout> | undefined) {
    if (timer !== undefined) clearTimeout(timer);
    return undefined;
  }

  function sendFailed() {
    stallTimer ??= setTimeout(() => {
      stalled = true;
      publish();
    }, STALL_AFTER_MS);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      pump();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
  }

  function sendReached() {
    stallTimer = clearTimer(stallTimer);
    retryDelay = FIRST_RETRY_MS;
    if (stalled) {
      stalled = false;
      publish();
    }
  }

  function tripGone() {
    status = "not_found";
    snapshot = undefined;
    queue = [];
    retryTimer = clearTimer(retryTimer);
    refetchTimer = clearTimer(refetchTimer);
    stallTimer = clearTimer(stallTimer);
    stalled = false;
    publish();
  }

  function settle(entry: Entry, outcome: SendOutcome) {
    sending = false;
    if (!queue.includes(entry)) return;
    if (outcome.kind === "retry") {
      sendFailed();
      return;
    }
    sendReached();
    if (outcome.kind === "ok") {
      entry.ackedAfterFetch = fetchSeq;
      reload();
      return;
    }
    if (outcome.code === "TRIP_NOT_FOUND") {
      tripGone();
      return;
    }
    queue = queue.filter((e) => e !== entry);
    publish();
    const rejection: Rejection = { change: entry.change, code: outcome.code, item: entry.item };
    for (const listener of rejectionListeners) listener(rejection);
    // A rejection means our view is out of date (e.g. the period changed).
    reload();
  }

  function pump() {
    if (sending || retryTimer !== undefined || status === "not_found") return;
    const entry = queue.find((e) => e.ackedAfterFetch === undefined);
    if (!entry) return;
    sending = true;
    send(entry.change).then(
      (outcome) => settle(entry, outcome),
      () => settle(entry, { kind: "retry" }),
    );
  }

  function applySnapshot(request: number, result: FetchTripResult) {
    if (result.status === "not_found") {
      tripGone();
      return;
    }
    status = "found";
    snapshot = result.trip;
    queue = queue.filter((e) => e.ackedAfterFetch === undefined || e.ackedAfterFetch >= request);
    publish();
  }

  function reload() {
    const request = ++fetchSeq;
    refetchTimer = clearTimer(refetchTimer);
    fetchSnapshot().then(
      (result) => {
        if (request === fetchSeq) applySnapshot(request, result);
      },
      () => {
        if (request !== fetchSeq) return;
        if (status !== "not_found") status = "error";
        publish();
        // A success is still waiting for its snapshot; try again.
        if (queue.some((e) => e.ackedAfterFetch !== undefined)) {
          refetchTimer = setTimeout(reload, REFETCH_RETRY_MS);
        }
      },
    );
    // Being asked to reload hints the network is back: retry a waiting change now.
    retryTimer = clearTimer(retryTimer);
    pump();
  }

  function submit(change: TripChange) {
    if (!snapshot || status === "not_found") return;
    const before = view();
    const entry: Entry = { change };
    queue = [...queue, entry];
    const after = view();
    const target = changeDefinition(change).item;
    if (target) {
      const id = target.id(change);
      entry.item = (target.from === "before" ? before : after)?.items.find((i) => i.id === id);
    }
    publish();
    pump();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reload,
    submit,
    onRejected(listener) {
      rejectionListeners.add(listener);
      return () => {
        rejectionListeners.delete(listener);
      };
    },
    stop() {
      retryTimer = clearTimer(retryTimer);
      refetchTimer = clearTimer(refetchTimer);
      stallTimer = clearTimer(stallTimer);
    },
  };
}
