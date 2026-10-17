import type { RpcClient } from "@/lib/rpc";
import { describe, expect, it } from "vitest";
import { fetchTrip } from "./fetch-trip";
import type { TripSnapshot } from "./snapshot";

/** A stand-in for the Supabase client at the network boundary. */
function clientReturning(result: { data: unknown; error: unknown }) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return result;
    },
  } as unknown as RpcClient;
  return { client, calls };
}

const snapshot: TripSnapshot = {
  title: "후쿠오카 먹방 여행",
  start_date: "2026-11-20",
  end_date: "2026-11-23",
  items: [],
};

describe("fetchTrip", () => {
  it("calls get_trip with the share token and returns the snapshot", async () => {
    const { client, calls } = clientReturning({ data: snapshot, error: null });

    await expect(fetchTrip("devExampleTrip00000000", client)).resolves.toEqual({
      status: "found",
      trip: snapshot,
    });
    expect(calls).toEqual([{ fn: "get_trip", args: { token: "devExampleTrip00000000" } }]);
  });

  it("reports a missing trip when the RPC raises TRIP_NOT_FOUND", async () => {
    const { client } = clientReturning({
      data: null,
      error: { code: "P0001", message: "TRIP_NOT_FOUND", details: "no trip has this share token" },
    });

    await expect(fetchTrip("noSuchTripToken0000000", client)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("throws on any other failure so the caller can retry instead of dropping the trip", async () => {
    const { client } = clientReturning({
      data: null,
      error: { code: "", message: "TypeError: Failed to fetch", details: "" },
    });

    await expect(fetchTrip("devExampleTrip00000000", client)).rejects.toThrow("Failed to fetch");
  });
});
