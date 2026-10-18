import { describe, expect, it } from "vitest";
import { createTrip } from "./create-trip";
import type { RpcClient } from "./rpc";

const input = { title: "오사카", startDate: "2026-11-20", endDate: "2026-11-23" };

/** A stand-in for the Supabase client at the network boundary. */
function stubClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown]> = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push([fn, args]);
      return result;
    },
  } as unknown as RpcClient;
  return { client, calls };
}

describe("createTrip", () => {
  it("calls create_trip with the RPC's argument names and returns the token", async () => {
    const { client, calls } = stubClient({ data: "AbCdEfGhIjKlMnOpQrStUv", error: null });
    await expect(createTrip(client, input)).resolves.toEqual({
      ok: true,
      token: "AbCdEfGhIjKlMnOpQrStUv",
    });
    expect(calls).toEqual([
      ["create_trip", { title: "오사카", start_date: "2026-11-20", end_date: "2026-11-23" }],
    ]);
  });

  it("reports the kill switch as disabled", async () => {
    const { client } = stubClient({
      data: null,
      error: { code: "P0001", message: "TRIP_CREATION_DISABLED", details: "", hint: "" },
    });
    await expect(createTrip(client, input)).resolves.toEqual({ ok: false, reason: "disabled" });
  });

  it("reports other failures as failed", async () => {
    const { client } = stubClient({
      data: null,
      error: { code: "P0001", message: "INVALID_PERIOD", details: "", hint: "" },
    });
    await expect(createTrip(client, input)).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("reports a thrown network error as failed", async () => {
    const client = {
      rpc: async () => {
        throw new TypeError("Failed to fetch");
      },
    } as unknown as RpcClient;
    await expect(createTrip(client, input)).resolves.toEqual({ ok: false, reason: "failed" });
  });
});
