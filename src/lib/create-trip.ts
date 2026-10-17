import type { TripInput } from "./trip-input";

/** The slice of the Supabase client this module needs. */
export type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type CreateTripResult =
  | { ok: true; token: string }
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
      return { ok: false, reason: error.message === "TRIP_CREATION_DISABLED" ? "disabled" : "failed" };
    }
    if (typeof data !== "string") return { ok: false, reason: "failed" };
    return { ok: true, token: data };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
