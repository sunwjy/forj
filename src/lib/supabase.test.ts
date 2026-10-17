import { describe, expect, it } from "vitest";
import { createSupabaseClient } from "./supabase";

describe("createSupabaseClient", () => {
  it("names the missing URL variable", () => {
    expect(() =>
      createSupabaseClient({ url: undefined, publishableKey: "sb_publishable_x" }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("names the missing publishable key variable", () => {
    expect(() =>
      createSupabaseClient({ url: "http://127.0.0.1:54321", publishableKey: "" }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("returns a client that can call RPCs when both values are set", () => {
    const client = createSupabaseClient({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_x",
    });
    expect(typeof client.rpc).toBe("function");
  });
});
