"use client";

import { useSyncExternalStore } from "react";
import { createRecentTrips, RECENT_TRIPS_KEY, type RecentTrip, type RecentTrips } from "./recent-trips";

let instance: RecentTrips | undefined;

function browserStorage(): Storage | null {
  try {
    // Reading `localStorage` itself throws when site data is blocked.
    return window.localStorage;
  } catch {
    return null;
  }
}

/** This browser's recent trips. Call it only in the browser (effects, event handlers). */
export function getRecentTrips(): RecentTrips {
  instance ??= createRecentTrips(browserStorage());
  return instance;
}

function subscribe(listener: () => void) {
  const unsubscribe = getRecentTrips().subscribe(listener);
  // Another tab changed the list.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === RECENT_TRIPS_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", onStorage);
  };
}

/** The recent trips list, or `null` while it is not known yet (server render and hydration). */
export function useRecentTrips(): RecentTrip[] | null {
  return useSyncExternalStore(
    subscribe,
    () => getRecentTrips().list(),
    () => null,
  );
}
