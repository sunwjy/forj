"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase";
import type { TripChange } from "./changes";
import { fetchTrip } from "./fetch-trip";
import { sendChange } from "./send-change";
import { createTripStore, type Rejection, type TripState, type TripStore } from "./trip-store";

/** What the trip screen uses to write (spec 6). */
export type TripWriter = {
  /** Shows the change at once and sends it in the background. */
  submit: (change: TripChange) => void;
  /** Called for each change the server refused (spec 6.5); returns an unsubscribe. */
  onRejected: (listener: (rejection: Rejection) => void) => () => void;
};

export type UseTrip = {
  /** The rebased view: server snapshot plus pending changes. */
  state: TripState;
  /** Refetches; only the newest response is applied, and waiting sends retry now (spec 6.4). */
  reload: () => void;
  writer: TripWriter;
  /** A change has failed to send for a few seconds (spec 6.3, 7.7). */
  stalled: boolean;
  /** Changes not yet confirmed by a snapshot. */
  pendingCount: number;
};

function storeFor(token: string): TripStore {
  return createTripStore({
    fetchSnapshot: () => fetchTrip(token),
    send: (change) => sendChange(getSupabase(), token, change),
  });
}

/**
 * Loads a trip by share token and keeps its local state (snapshot + queue).
 * While changes are pending, closing the tab asks for confirmation (spec 6.3).
 */
export function useTrip(token: string): UseTrip {
  const [store, setStore] = useState(() => ({ token, store: storeFor(token) }));
  if (store.token !== token) setStore({ token, store: storeFor(token) });
  const current = store.store;

  const snapshot = useSyncExternalStore(current.subscribe, current.getState, current.getState);

  useEffect(() => {
    current.reload();
    return current.stop;
  }, [current]);

  const unsaved = snapshot.pendingCount > 0;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const writer = useMemo(() => ({ submit: current.submit, onRejected: current.onRejected }), [current]);

  return {
    state: snapshot.trip,
    reload: current.reload,
    writer,
    stalled: snapshot.stalled,
    pendingCount: snapshot.pendingCount,
  };
}
