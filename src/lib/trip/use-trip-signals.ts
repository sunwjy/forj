"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ShareToken } from "./branded";
import { createTripSignals, type TripSignalsDeps } from "./trip-signals";

/** The public channel the DB triggers broadcast to (spec 5.6, ADR 0002). */
function tripChannel(token: ShareToken): TripSignalsDeps["channel"] {
  return ({ onChanged, onStatus }) => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`trip:${token}`, { config: { private: false } })
      // The payload is ignored: a signal only means "refetch".
      .on("broadcast", { event: "changed" }, () => onChanged())
      .subscribe((status) => onStatus(status as Parameters<typeof onStatus>[0]));
    return () => {
      void supabase.removeChannel(channel);
    };
  };
}

/** The tab becoming visible again or the network coming back (spec 6.4), and the network going away. */
const pageEvents: TripSignalsDeps["page"] = ({ onVisible, onOnline, onOffline }) => {
  const onVisibility = () => {
    if (document.visibilityState === "visible") onVisible();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
  };
};

/**
 * Refetches the trip when someone changes it, and reports whether the realtime
 * channel is down (spec 6.4, 7.7). `reload` should be stable.
 */
export function useTripSignals(token: ShareToken, reload: () => void): { disconnected: boolean } {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    const signals = createTripSignals({ reload, channel: tripChannel(token), page: pageEvents });
    const unsubscribe = signals.subscribe(() => setDisconnected(signals.isDisconnected()));
    return () => {
      unsubscribe();
      signals.stop();
      setDisconnected(false);
    };
  }, [token, reload]);

  return { disconnected };
}
