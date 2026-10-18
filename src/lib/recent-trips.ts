import type { Period } from "./trip-input";
import type { TripState } from "./trip/trip-store";

/** The slice of `localStorage` recent trips need. */
export type RecentTripsStorage = Pick<Storage, "getItem" | "setItem">;

export type RecentTripInput = { token: string; title: string } & Period;

/** A trip in this browser's recent trips (spec 7.2): a snapshot plus when it was last opened. */
export type RecentTrip = RecentTripInput & {
  /** Epoch milliseconds. */
  openedAt: number;
};

export type RecentTrips = ReturnType<typeof createRecentTrips>;

export const RECENT_TRIPS_KEY = "forj.recentTrips";
export const MAX_RECENT_TRIPS = 50;

function isRecentTrip(value: unknown): value is RecentTrip {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.token === "string" &&
    typeof entry.title === "string" &&
    typeof entry.startDate === "string" &&
    typeof entry.endDate === "string" &&
    typeof entry.openedAt === "number"
  );
}

function parse(raw: string): RecentTrip[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isRecentTrip) : [];
  } catch {
    return [];
  }
}

/**
 * This browser's recent trips (spec 7.2), most recently opened first, at most
 * 50. The list lives in `storage` (`localStorage`) and is mirrored in memory,
 * so it keeps working for the visit when storage is missing, blocked or full.
 * `list()` returns the same array until the list changes, which suits
 * `useSyncExternalStore`.
 */
export function createRecentTrips(storage: RecentTripsStorage | null, now: () => number = Date.now) {
  let raw: string | null = null;
  let trips: RecentTrip[] = [];
  /** After a failed write the stored list is stale, so memory becomes the source. */
  let memoryOnly = storage === null;
  const listeners = new Set<() => void>();

  function read(): RecentTrip[] {
    if (memoryOnly || !storage) return trips;
    let next: string | null;
    try {
      next = storage.getItem(RECENT_TRIPS_KEY);
    } catch {
      return trips;
    }
    if (next !== raw) {
      raw = next;
      trips = next === null ? [] : parse(next);
    }
    return trips;
  }

  function write(next: RecentTrip[]) {
    trips = [...next].sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_RECENT_TRIPS);
    raw = JSON.stringify(trips);
    try {
      storage?.setItem(RECENT_TRIPS_KEY, raw);
    } catch {
      // Blocked or full: keep going in memory for this visit.
      memoryOnly = true;
    }
    for (const listener of listeners) listener();
  }

  return {
    list(): RecentTrip[] {
      return read();
    },
    /** Adds the trip, or refreshes its snapshot, as opened now. */
    remember(trip: RecentTripInput) {
      const others = read().filter((entry) => entry.token !== trip.token);
      write([{ ...trip, openedAt: now() }, ...others]);
    },
    /** Removes a trip from the list (the trip itself stays) and returns it for 「되돌리기」. */
    forget(token: string): RecentTrip | undefined {
      const current = read();
      const forgotten = current.find((entry) => entry.token === token);
      if (forgotten) write(current.filter((entry) => entry !== forgotten));
      return forgotten;
    },
    /** Puts a forgotten trip back in its old place, unless it has been opened again since. */
    restore(trip: RecentTrip) {
      const current = read();
      if (current.some((entry) => entry.token === trip.token)) return;
      write([...current, trip]);
    },
    /** Calls `listener` after every change made through this instance. */
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Keeps recent trips in step with a trip screen lookup (spec 7.2): a found
 * trip is remembered as opened now, `TRIP_NOT_FOUND` drops it, and a network
 * error leaves it alone because the trip may still exist.
 */
export function recordTripLookup(recent: RecentTrips, token: string, state: TripState) {
  if (state.status === "found") {
    const { title, start_date: startDate, end_date: endDate } = state.trip;
    recent.remember({ token, title, startDate, endDate });
  } else if (state.status === "not_found") {
    recent.forget(token);
  }
}

const TRIP_PATH = /^\/t\/([^/]+)\/?$/;

/**
 * Drops the trip whose screen is at `pathname` (`/t/<token>`) from recent
 * trips. For the not-found page a missing trip renders on first open, where
 * the server answered `TRIP_NOT_FOUND` before the trip screen could mount
 * (spec 7.2, 7.6). Any other path is left alone.
 */
export function forgetTripAtPath(recent: RecentTrips, pathname: string) {
  const match = TRIP_PATH.exec(pathname);
  if (match) recent.forget(match[1]);
}
