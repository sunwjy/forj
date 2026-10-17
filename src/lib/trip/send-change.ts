import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripChange } from "./changes";

/**
 * How one attempt to send a change ended (spec 6.3, 6.5).
 * - `ok`: the server applied it.
 * - `rejected`: the server refused it; `code` is the RPC error code (spec 5.5),
 *   or `UNKNOWN` for other client errors that a retry cannot fix.
 * - `retry`: network error, timeout or server error; send it again later.
 */
export type SendOutcome = { kind: "ok" } | { kind: "rejected"; code: string } | { kind: "retry" };

export const SEND_TIMEOUT_MS = 10_000;

function rpcCall(token: string, change: TripChange): [string, Record<string, unknown>] {
  switch (change.kind) {
    case "create_item": {
      const { id, date, title, memo, start_time, end_time, emoji } = change.item;
      return ["create_item", { token, id, date, title, memo, start_time, end_time, emoji }];
    }
    case "update_item":
      return ["update_item", { token, item_id: change.id, patch: change.patch }];
    case "delete_item":
      return ["delete_item", { token, item_id: change.id }];
    case "update_trip_title":
      return ["update_trip_title", { token, title: change.title }];
    case "set_trip_dates": {
      const { start_date, end_date, deleted_ids } = change;
      return ["set_trip_dates", { token, start_date, end_date, confirmed_deleted_ids: deleted_ids }];
    }
  }
}

type RpcError = { code?: string; message?: string } | null;

/** Sends one change through its RPC (spec 5.3) and classifies the result. */
export async function sendChange(client: SupabaseClient, token: string, change: TripChange): Promise<SendOutcome> {
  const [fn, args] = rpcCall(token, change);
  let response: { error: RpcError; status: number };
  try {
    response = await client.rpc(fn, args).abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS));
  } catch {
    return { kind: "retry" };
  }
  const { error, status } = response;
  if (!error) return { kind: "ok" };
  // RPC errors are raised with errcode P0001 and the code in `message` (spec 5.5).
  if (error.code === "P0001" && error.message) return { kind: "rejected", code: error.message };
  // supabase-js reports network failures and aborted requests with status 0.
  if (status === 0 || status === 408 || status >= 500) return { kind: "retry" };
  return { kind: "rejected", code: "UNKNOWN" };
}
