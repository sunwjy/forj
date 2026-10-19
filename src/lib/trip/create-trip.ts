import { rpcErrorCode, type RpcClient } from "@/lib/rpc";
import type { ShareToken } from "./branded";
import type { TripInput } from "./trip-input";

export type CreateTripResult =
  | { ok: true; token: ShareToken }
  /** `disabled`: the kill switch is off (spec 8). `failed`: anything else. */
  | { ok: false; reason: "disabled" | "failed" };

/** Calls `create_trip`, which returns only the new trip's share token (spec 5.3). */
export async function createTrip(client: RpcClient, input: TripInput): Promise<CreateTripResult> {
  try {
    const { data, error } = await client.rpc("create_trip", {
      title: input.title,
      start_date: input.startDate,
      end_date: input.endDate,
    });
    if (error) {
      return { ok: false, reason: rpcErrorCode(error) === "TRIP_CREATION_DISABLED" ? "disabled" : "failed" };
    }
    if (typeof data !== "string") return { ok: false, reason: "failed" };
    // `create_trip` issued it, so it is cast without a runtime check.
    return { ok: true, token: data as ShareToken };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
