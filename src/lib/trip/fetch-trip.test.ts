import type { RpcClient } from "@/lib/rpc";
import { describe, expect, it } from "vitest";
import { fetchTrip } from "./fetch-trip";
import type { TripSnapshot } from "./snapshot";
import { hhMm, isoDate, shareToken } from "./test-values";

const token = shareToken("devExampleTrip00000000");

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

/** `get_trip`'s response, exactly as the server sends it. */
const response = {
  title: "후쿠오카 먹방 여행",
  start_date: "2026-11-20",
  end_date: "2026-11-23",
  items: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      date: "2026-11-20",
      title: "라멘",
      memo: "줄 서기",
      start_time: "23:00",
      end_time: "01:00",
      emoji: "🍜",
      created_at: "2026-10-17T00:00:00.123456Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      date: "2026-11-21",
      title: "산책",
      memo: null,
      start_time: null,
      end_time: null,
      emoji: null,
      created_at: "2026-10-17T00:00:01.000000Z",
    },
  ],
};

const snapshot: TripSnapshot = {
  title: "후쿠오카 먹방 여행",
  startDate: isoDate("2026-11-20"),
  endDate: isoDate("2026-11-23"),
  items: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      date: isoDate("2026-11-20"),
      title: "라멘",
      memo: "줄 서기",
      startTime: hhMm("23:00"),
      endTime: hhMm("01:00"),
      emoji: "🍜",
      createdAt: "2026-10-17T00:00:00.123456Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      date: isoDate("2026-11-21"),
      title: "산책",
      memo: null,
      startTime: null,
      endTime: null,
      emoji: null,
      createdAt: "2026-10-17T00:00:01.000000Z",
    },
  ],
};

describe("fetchTrip", () => {
  it("calls get_trip with the share token and returns the snapshot in camelCase", async () => {
    const { client, calls } = clientReturning({ data: response, error: null });

    await expect(fetchTrip(token, client)).resolves.toEqual({
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

    await expect(fetchTrip(shareToken("noSuchTripToken0000000"), client)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("throws on any other failure so the caller can retry instead of dropping the trip", async () => {
    const { client } = clientReturning({
      data: null,
      error: { code: "", message: "TypeError: Failed to fetch", details: "" },
    });

    await expect(fetchTrip(token, client)).rejects.toThrow("Failed to fetch");
  });
});
