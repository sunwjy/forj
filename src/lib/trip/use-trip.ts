"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTrip } from "./fetch-trip";
import type { TripSnapshot } from "./snapshot";

export type TripState =
  | { status: "loading" }
  | { status: "found"; trip: TripSnapshot }
  | { status: "not_found" }
  | { status: "error"; trip?: TripSnapshot };

/**
 * Loads a trip by share token and keeps the latest snapshot.
 * `reload` refetches; when calls overlap only the newest response is applied
 * (spec 6.4), so realtime signals and visibility changes can call it freely.
 * A failed reload keeps the last snapshot on screen.
 */
export function useTrip(token: string): { state: TripState; reload: () => void } {
  const [state, setState] = useState<TripState>({ status: "loading" });
  const latest = useRef(0);

  const reload = useCallback(() => {
    const request = ++latest.current;
    fetchTrip(token).then(
      (result) => {
        if (request !== latest.current) return;
        setState(result);
      },
      () => {
        if (request !== latest.current) return;
        setState((prev) => ({
          status: "error",
          trip: prev.status === "found" || prev.status === "error" ? prev.trip : undefined,
        }));
      },
    );
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { state, reload };
}
