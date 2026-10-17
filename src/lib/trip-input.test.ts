import { describe, expect, it } from "vitest";
import { validateTripInput } from "./trip-input";

const valid = { title: "오사카 먹방 여행", startDate: "2026-11-20", endDate: "2026-11-23" };

describe("validateTripInput", () => {
  it("accepts a trip and trims the title", () => {
    expect(validateTripInput({ ...valid, title: "  오사카  " })).toEqual({
      ok: true,
      value: { title: "오사카", startDate: "2026-11-20", endDate: "2026-11-23" },
    });
  });

  it("rejects a blank title", () => {
    expect(validateTripInput({ ...valid, title: "   " })).toEqual({
      ok: false,
      field: "title",
      message: "여행 제목을 입력해 주세요.",
    });
  });

  it("counts title length in code points", () => {
    expect(validateTripInput({ ...valid, title: "😀".repeat(100) }).ok).toBe(true);
    expect(validateTripInput({ ...valid, title: "😀".repeat(101) })).toEqual({
      ok: false,
      field: "title",
      message: "여행 제목은 100자까지 쓸 수 있어요.",
    });
  });

  it("asks for both dates", () => {
    expect(validateTripInput({ ...valid, startDate: "" })).toEqual({
      ok: false,
      field: "period",
      message: "시작일과 종료일을 골라 주세요.",
    });
    expect(validateTripInput({ ...valid, endDate: "" })).toMatchObject({ field: "period" });
  });

  it("allows a one-day trip and a past trip", () => {
    expect(validateTripInput({ ...valid, startDate: "2026-11-20", endDate: "2026-11-20" }).ok).toBe(true);
    expect(validateTripInput({ ...valid, startDate: "2001-01-01", endDate: "2001-01-02" }).ok).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    expect(validateTripInput({ ...valid, startDate: "2026-11-21", endDate: "2026-11-20" })).toEqual({
      ok: false,
      field: "period",
      message: "종료일은 시작일보다 앞설 수 없어요.",
    });
  });

  it("allows 30 days and rejects 31", () => {
    expect(validateTripInput({ ...valid, startDate: "2026-11-01", endDate: "2026-11-30" }).ok).toBe(true);
    expect(validateTripInput({ ...valid, startDate: "2026-11-01", endDate: "2026-12-01" })).toEqual({
      ok: false,
      field: "period",
      message: "여행 기간은 최대 30일이에요.",
    });
  });

  it("counts days across a DST change and a month end", () => {
    // 2026-03-08 is the US DST switch; date math must not depend on local time.
    expect(validateTripInput({ ...valid, startDate: "2026-02-20", endDate: "2026-03-21" }).ok).toBe(true);
    expect(validateTripInput({ ...valid, startDate: "2026-02-20", endDate: "2026-03-22" }).ok).toBe(false);
  });

  it("checks the title before the period", () => {
    expect(validateTripInput({ title: "", startDate: "", endDate: "" })).toMatchObject({ field: "title" });
  });
});
