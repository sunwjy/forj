import { rpcErrorCode, type RpcClient } from "@/lib/rpc";
import { getSupabase } from "@/lib/supabase";
import type { TripSnapshot } from "./snapshot";

export type FetchTripResult = { status: "found"; trip: TripSnapshot } | { status: "not_found" };

/**
 * Loads a trip snapshot by share token through `get_trip` (spec 5.3).
 * `TRIP_NOT_FOUND` is a result, not an error, because it changes the screen
 * (spec 7.6). Any other failure, such as a network error, is thrown: the trip
 * may still exist, so callers must not treat it as missing (spec 7.2).
 */
export async function fetchTrip(token: string, client: RpcClient = getSupabase()): Promise<FetchTripResult> {
  const { data, error } = await client.rpc("get_trip", { token });
  if (error) {
    if (rpcErrorCode(error) === "TRIP_NOT_FOUND") return { status: "not_found" };
    throw new Error(error.message || "get_trip failed", { cause: error });
  }
  return { status: "found", trip: data as TripSnapshot };
}
