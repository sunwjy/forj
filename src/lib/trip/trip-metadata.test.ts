import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { TripSnapshot } from "./snapshot";
import { tripMetadata } from "./trip-metadata";

/** A stand-in for the Supabase client at the network boundary. */
function clientReturning(result: { data: unknown; error: unknown }) {
  return { rpc: async () => result } as unknown as SupabaseClient;
}

const snapshot: TripSnapshot = {
  title: "후쿠오카 먹방 여행",
  start_date: "2026-11-20",
  end_date: "2026-11-23",
  items: [],
};

describe("tripMetadata", () => {
  it("puts the trip's title and period into the link preview", async () => {
    const client = clientReturning({ data: snapshot, error: null });

    await expect(tripMetadata("devExampleTrip00000000", client)).resolves.toEqual({
      title: "후쿠오카 먹방 여행",
      description: "11.20 (금) – 11.23 (월) · 3박 4일",
      openGraph: {
        title: "후쿠오카 먹방 여행",
        description: "11.20 (금) – 11.23 (월) · 3박 4일",
      },
    });
  });

  it("reports a missing trip so the page can answer 404", async () => {
    const client = clientReturning({
      data: null,
      error: { code: "P0001", message: "TRIP_NOT_FOUND", details: "no trip has this share token" },
    });

    await expect(tripMetadata("noSuchTripToken0000000", client)).resolves.toBe("not_found");
  });

  it("falls back to the app's own preview when the trip cannot be loaded", async () => {
    const client = clientReturning({
      data: null,
      error: { code: "", message: "TypeError: fetch failed", details: "" },
    });

    await expect(tripMetadata("devExampleTrip00000000", client)).resolves.toEqual({});
  });
});
