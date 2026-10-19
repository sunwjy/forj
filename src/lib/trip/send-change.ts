import { rpcErrorCode, type RpcClient } from "@/lib/rpc";
import { changeKind, type TripChange } from "./changes";

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/** Renames the keys of `args`, and of objects nested in it (`patch`), the way the server spells them. */
function serverArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([name, value]) => [serverName(name), isPlainObject(value) ? serverArgs(value) : value]),
  );
}

/** Sends one change through its RPC (spec 5.3) and classifies the result. */
export async function sendChange(client: RpcClient, token: string, change: TripChange): Promise<SendOutcome> {
  const { name, args } = changeKind(change).rpc(change);
  let response: Awaited<ReturnType<RpcClient["rpc"]>>;
  try {
    response = await client.rpc(name, { token, ...serverArgs(args) }).abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS));
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
