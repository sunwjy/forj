import type { RpcClient } from "@/lib/rpc";
import { describe, expect, it } from "vitest";
import { sendChange } from "./send-change";
import type { ItemSnapshot } from "./snapshot";

type Response = { data: unknown; error: unknown; status: number };

/** A stand-in for the Supabase client at the network boundary. */
function clientAnswering(answer: () => Response | Promise<Response>) {
  const calls: { fn: string; args: unknown; signal?: AbortSignal }[] = [];
  const client = {
    rpc: (fn: string, args: unknown) => {
      const call: (typeof calls)[number] = { fn, args };
      calls.push(call);
      return {
        abortSignal(signal: AbortSignal) {
          call.signal = signal;
          return Promise.resolve().then(answer);
        },
      };
    },
  } as unknown as RpcClient;
  return { client, calls };
}

const ok = () => ({ data: null, error: null, status: 204 });
const token = "devExampleTrip00000000";

const item: ItemSnapshot = {
  id: "00000000-0000-4000-8000-000000000999",
  date: "2026-11-20",
  title: "라멘",
  memo: null,
  startTime: "12:00",
  endTime: null,
  emoji: "🍜",
  createdAt: "2026-10-17T00:00:00.000000Z",
};

describe("sendChange", () => {
  it("creates an item with its client-generated id and every field", async () => {
    const { client, calls } = clientAnswering(ok);
    await expect(sendChange(client, token, { kind: "create_item", item })).resolves.toEqual({ kind: "ok" });
    expect(calls).toEqual([
      {
        fn: "create_item",
        args: {
          token,
          id: item.id,
          date: "2026-11-20",
          title: "라멘",
          memo: null,
          start_time: "12:00",
          end_time: null,
          emoji: "🍜",
        },
        signal: expect.anything(),
      },
    ]);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("updates an item with only its patch", async () => {
    const { client, calls } = clientAnswering(ok);
    await sendChange(client, token, { kind: "update_item", id: item.id, patch: { memo: null } });
    expect(calls).toMatchObject([{ fn: "update_item", args: { token, item_id: item.id, patch: { memo: null } } }]);
  });

  it("sends the patch's field names as the server spells them", async () => {
    const { client, calls } = clientAnswering(ok);
    await sendChange(client, token, {
      kind: "update_item",
      id: item.id,
      patch: { date: "2026-11-21", startTime: "23:00", endTime: "01:00", emoji: null },
    });
    expect(calls).toEqual([
      {
        fn: "update_item",
        args: {
          token,
          item_id: item.id,
          patch: { date: "2026-11-21", start_time: "23:00", end_time: "01:00", emoji: null },
        },
        signal: expect.anything(),
      },
    ]);
  });

  it("deletes an item", async () => {
    const { client, calls } = clientAnswering(ok);
    await sendChange(client, token, { kind: "delete_item", id: item.id });
    expect(calls).toMatchObject([{ fn: "delete_item", args: { token, item_id: item.id } }]);
  });

  it("changes the trip title", async () => {
    const { client, calls } = clientAnswering(ok);
    await sendChange(client, token, { kind: "update_trip_title", title: "후쿠오카" });
    expect(calls).toEqual([{ fn: "update_trip_title", args: { token, title: "후쿠오카" }, signal: expect.anything() }]);
  });

  it("changes the period with the confirmed deletions", async () => {
    const { client, calls } = clientAnswering(ok);
    await sendChange(client, token, {
      kind: "set_trip_dates",
      startDate: "2026-11-20",
      endDate: "2026-11-21",
      confirmedDeletedIds: [item.id],
    });
    expect(calls).toEqual([
      {
        fn: "set_trip_dates",
        args: { token, start_date: "2026-11-20", end_date: "2026-11-21", confirmed_deleted_ids: [item.id] },
        signal: expect.anything(),
      },
    ]);
  });

  it("reports the error code when the server rejects the change", async () => {
    const { client } = clientAnswering(() => ({
      data: null,
      error: { code: "P0001", message: "DATE_OUT_OF_RANGE", details: "the date is outside the trip" },
      status: 400,
    }));
    await expect(sendChange(client, token, { kind: "create_item", item })).resolves.toEqual({
      kind: "rejected",
      code: "DATE_OUT_OF_RANGE",
    });
  });

  it("asks for a retry on network errors, timeouts and server errors", async () => {
    const network = clientAnswering(() => ({ data: null, error: { message: "TypeError: fetch failed", code: "" }, status: 0 }));
    const unavailable = clientAnswering(() => ({ data: null, error: { message: "Service Unavailable", code: "" }, status: 503 }));
    const thrown = clientAnswering(() => Promise.reject(new Error("aborted")));
    for (const { client } of [network, unavailable, thrown]) {
      await expect(sendChange(client, token, { kind: "delete_item", id: item.id })).resolves.toEqual({ kind: "retry" });
    }
  });

  it("rejects other client errors instead of retrying them forever", async () => {
    const { client } = clientAnswering(() => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.create_item" },
      status: 404,
    }));
    await expect(sendChange(client, token, { kind: "create_item", item })).resolves.toEqual({
      kind: "rejected",
      code: "UNKNOWN",
    });
  });
});
