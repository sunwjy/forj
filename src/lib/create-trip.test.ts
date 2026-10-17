import { describe, expect, it } from "vitest";
import { createTrip, type RpcClient } from "./create-trip";

const input = { title: "오사카", startDate: "2026-11-20", endDate: "2026-11-23" };

function stubClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown]> = [];
  const client: RpcClient = {
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      return result as Awaited<ReturnType<RpcClient["rpc"]>>;
    },
  };
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
    const client: RpcClient = {
      rpc: async () => {
        throw new TypeError("Failed to fetch");
      },
    };
    await expect(createTrip(client, input)).resolves.toEqual({ ok: false, reason: "failed" });
  });
});
