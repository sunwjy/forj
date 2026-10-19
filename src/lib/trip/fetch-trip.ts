import { rpcErrorCode, type RpcClient } from "@/lib/rpc";
import { getSupabase } from "@/lib/supabase";
import type { HhMm, IsoDate, ShareToken } from "./branded";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";

export type FetchTripResult = { status: "found"; trip: TripSnapshot } | { status: "not_found" };

/** An item as `get_trip` returns it (spec 5.3). */
type ItemRow = {
  id: string;
  date: string;
  title: string;
  memo: string | null;
  start_time: string | null;
  end_time: string | null;
  emoji: string | null;
  created_at: string;
};

/** What `get_trip` returns (spec 5.3). */
type TripRow = { title: string; start_date: string; end_date: string; items: ItemRow[] };

// The server checked these formats on the way in, so they are cast without a runtime check.
function toItemSnapshot(row: ItemRow): ItemSnapshot {
  return {
    id: row.id,
    date: row.date as IsoDate,
    title: row.title,
    memo: row.memo,
    startTime: row.start_time as HhMm | null,
    endTime: row.end_time as HhMm | null,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function toTripSnapshot(row: TripRow): TripSnapshot {
  return {
    title: row.title,
    startDate: row.start_date as IsoDate,
    endDate: row.end_date as IsoDate,
    items: row.items.map(toItemSnapshot),
  };
}

/**
 * Loads a trip snapshot by share token through `get_trip` (spec 5.3).
 * `TRIP_NOT_FOUND` is a result, not an error, because it changes the screen
 * (spec 7.6). Any other failure, such as a network error, is thrown: the trip
 * may still exist, so callers must not treat it as missing (spec 7.2).
 */
export async function fetchTrip(token: ShareToken, client: RpcClient = getSupabase()): Promise<FetchTripResult> {
  const { data, error } = await client.rpc("get_trip", { token });
  if (error) {
    if (rpcErrorCode(error) === "TRIP_NOT_FOUND") return { status: "not_found" };
    throw new Error(error.message || "get_trip failed", { cause: error });
  }
  return { status: "found", trip: toTripSnapshot(data as TripRow) };
}
