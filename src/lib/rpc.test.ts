import { describe, expect, it } from "vitest";
import { rpcErrorCode } from "./rpc";

describe("rpcErrorCode", () => {
  it("reads the code an RPC raised from the message (spec 5.5)", () => {
    expect(rpcErrorCode({ code: "P0001", message: "TRIP_NOT_FOUND", details: "no trip has this share token" })).toBe(
      "TRIP_NOT_FOUND",
    );
  });

  it("gives nothing for errors no RPC raised", () => {
    expect(rpcErrorCode(null)).toBeUndefined();
    expect(rpcErrorCode({ code: "", message: "TypeError: Failed to fetch" })).toBeUndefined();
    expect(rpcErrorCode({ code: "PGRST202", message: "Could not find the function public.create_item" })).toBeUndefined();
    expect(rpcErrorCode({ code: "P0001", message: "" })).toBeUndefined();
  });
});
