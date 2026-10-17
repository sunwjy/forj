import type { SupabaseClient } from "@supabase/supabase-js";

/** The slice of the Supabase client the RPC wrappers need. */
export type RpcClient = Pick<SupabaseClient, "rpc">;

/**
 * The code an RPC raised (spec 5.5): errcode `P0001` with the code in
 * `message`. Anything else, such as a network or PostgREST error, gives
 * `undefined`.
 */
export function rpcErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "P0001" && typeof message === "string" && message !== "" ? message : undefined;
}
