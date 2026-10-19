import { rpcErrorCode, type RpcClient } from "@/lib/rpc";
import type { ShareToken } from "./branded";
import { changeDefinition, type TripChange } from "./changes";

/**
 * How one attempt to send a change ended (spec 6.3, 6.5).
 * - `ok`: the server applied it.
 * - `rejected`: the server refused it; `code` is the RPC error code (spec 5.5),
 *   or `UNKNOWN` for other client errors that a retry cannot fix.
 * - `retry`: network error, timeout or server error; send it again later.
 */
export type SendOutcome = { kind: "ok" } | { kind: "rejected"; code: string } | { kind: "retry" };

export const SEND_TIMEOUT_MS = 10_000;

/** `startTime` → `start_time`: how the server spells an argument or field name. */
function serverName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Renames the keys of `fields` the way the server spells them. */
function serverFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [serverName(name), value]));
}

/**
 * Renames the argument names in `args` the way the server spells them, and the
 * field names inside `update_item`'s `patch`. Other values are sent as they are.
 */
function serverArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const renamed = serverFields(args);
  if (name === "update_item") renamed.patch = serverFields(args.patch as Record<string, unknown>);
  return renamed;
}

/** Sends one change through its RPC (spec 5.3) and classifies the result. */
export async function sendChange(client: RpcClient, token: ShareToken, change: TripChange): Promise<SendOutcome> {
  const { name, args } = changeDefinition(change).rpc(change);
  let response: Awaited<ReturnType<RpcClient["rpc"]>>;
  try {
    response = await client.rpc(name, { token, ...serverArgs(name, args) }).abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS));
  } catch {
    return { kind: "retry" };
  }
  const { error, status } = response;
  if (!error) return { kind: "ok" };
  const code = rpcErrorCode(error);
  if (code) return { kind: "rejected", code };
  // supabase-js reports network failures and aborted requests with status 0.
  if (status === 0 || status === 408 || status >= 500) return { kind: "retry" };
  return { kind: "rejected", code: "UNKNOWN" };
}
