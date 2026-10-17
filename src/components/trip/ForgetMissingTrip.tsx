"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { forgetTripAtPath } from "@/lib/recent-trips";
import { getRecentTrips } from "@/lib/use-recent-trips";

/**
 * Drops the trip in the URL from recent trips. The not-found page renders it
 * because a trip whose server lookup gave `TRIP_NOT_FOUND` never mounts the
 * trip screen, and a not-found page cannot read the route's params.
 */
export function ForgetMissingTrip() {
  const pathname = usePathname();
  useEffect(() => forgetTripAtPath(getRecentTrips(), pathname), [pathname]);
  return null;
}
