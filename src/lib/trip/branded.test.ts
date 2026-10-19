import { describe, expect, it } from "vitest";
import { parseHhMm, parseIsoDate, parseShareToken } from "./branded";

describe("parseIsoDate", () => {
  it("accepts a real YYYY-MM-DD date as the same string", () => {
    expect(parseIsoDate("2026-11-20")).toBe("2026-11-20");
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29");
  });

  it("rejects other formats", () => {
    for (const s of ["", "2026-1-20", "2026/11/20", "20261120", "2026-11-20T00:00", " 2026-11-20", "abcd-ef-gh"]) {
      expect(parseIsoDate(s)).toBeNull();
    }
  });

  it("rejects dates that do not exist", () => {
    for (const s of ["2026-02-30", "2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2026-11-00"]) {
      expect(parseIsoDate(s)).toBeNull();
    }
  });
});

describe("parseHhMm", () => {
  it("accepts HH:MM from 00:00 to 23:59 as the same string", () => {
    for (const s of ["00:00", "09:05", "23:59"]) expect(parseHhMm(s)).toBe(s);
  });

  it("rejects other formats and out-of-range times", () => {
    for (const s of ["", "9:05", "09:5", "0905", "09:05:00", "24:00", "12:60", "ab:cd", " 09:05"]) {
      expect(parseHhMm(s)).toBeNull();
    }
  });
});

describe("parseShareToken", () => {
  it("accepts a 22-character base64url token as the same string", () => {
    for (const s of ["devExampleTrip00000000", "AbCd-_0123456789xyzXYZ"]) expect(parseShareToken(s)).toBe(s);
  });

  it("rejects other shapes", () => {
    const bad = ["", "short", "devExampleTrip0000000", "devExampleTrip000000000", "devExampleTrip0000000=", "devExampleTrip/0000000"];
    for (const s of bad) expect(parseShareToken(s)).toBeNull();
  });
});
