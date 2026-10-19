import { describe, expect, it } from "vitest";
import type { ItemFields } from "./changes";
import { isSingleEmoji, itemPatch, validateItemDraft, type ItemDraft } from "./item-draft";
import { hhMm, isoDate } from "./test-values";

const base: ItemFields = {
  date: isoDate("2026-11-20"),
  title: "라멘",
  memo: "줄 서기",
  startTime: hhMm("12:00"),
  endTime: hhMm("13:00"),
  emoji: "🍜",
};

describe("itemPatch", () => {
  it("is empty when nothing changed", () => {
    expect(itemPatch(base, { ...base })).toEqual({});
  });

  it("holds only the fields that changed", () => {
    expect(itemPatch(base, { ...base, title: "돈코츠 라멘", emoji: null })).toEqual({
      title: "돈코츠 라멘",
      emoji: null,
    });
    expect(itemPatch(base, { ...base, date: isoDate("2026-11-21"), memo: null })).toEqual({
      date: "2026-11-21",
      memo: null,
    });
  });

  it("sends the start and end times together when only one of them changed", () => {
    expect(itemPatch(base, { ...base, endTime: hhMm("14:00") })).toEqual({
      startTime: "12:00",
      endTime: "14:00",
    });
    expect(itemPatch(base, { ...base, startTime: hhMm("11:00") })).toEqual({
      startTime: "11:00",
      endTime: "13:00",
    });
    expect(itemPatch(base, { ...base, startTime: null, endTime: null })).toEqual({
      startTime: null,
      endTime: null,
    });
  });
});

const draft: ItemDraft = {
  emoji: "",
  title: "  라멘 ",
  date: "2026-11-20",
  startTime: "",
  endTime: "",
  memo: "",
};

describe("validateItemDraft", () => {
  it("trims the title, keeps a memo as written and nulls a blank one", () => {
    expect(validateItemDraft({ ...draft, memo: "  \n " })).toEqual({
      ok: true,
      fields: { date: "2026-11-20", title: "라멘", memo: null, startTime: null, endTime: null, emoji: null },
    });
    expect(
      validateItemDraft({ ...draft, emoji: "✈️", memo: " 2터미널\n짐 맡기기 ", startTime: "09:00", endTime: "10:30" }),
    ).toEqual({
      ok: true,
      fields: {
        date: "2026-11-20",
        title: "라멘",
        memo: " 2터미널\n짐 맡기기 ",
        startTime: "09:00",
        endTime: "10:30",
        emoji: "✈️",
      },
    });
  });

  it("allows an end time at or before the start time (the next day)", () => {
    expect(validateItemDraft({ ...draft, startTime: "20:00", endTime: "01:00" }).ok).toBe(true);
    expect(validateItemDraft({ ...draft, startTime: "20:00", endTime: "20:00" }).ok).toBe(true);
  });

  it("requires a title of 1 to 100 code points", () => {
    expect(validateItemDraft({ ...draft, title: "   " })).toMatchObject({ ok: false, field: "title" });
    expect(validateItemDraft({ ...draft, title: "😀".repeat(100) }).ok).toBe(true);
    expect(validateItemDraft({ ...draft, title: "가".repeat(101) })).toMatchObject({ ok: false, field: "title" });
  });

  it("limits the memo to 2,000 code points", () => {
    expect(validateItemDraft({ ...draft, memo: "메".repeat(2000) }).ok).toBe(true);
    expect(validateItemDraft({ ...draft, memo: "메".repeat(2001) })).toMatchObject({ ok: false, field: "memo" });
  });

  it("rejects an end time without a start time", () => {
    expect(validateItemDraft({ ...draft, endTime: "10:00" })).toMatchObject({ ok: false, field: "time" });
  });

  it("rejects an emoji that is not a single emoji", () => {
    expect(validateItemDraft({ ...draft, emoji: "🍜🍣" })).toMatchObject({ ok: false, field: "emoji" });
  });

  it("rejects a date that is not a real YYYY-MM-DD date", () => {
    expect(validateItemDraft({ ...draft, date: "" })).toMatchObject({ ok: false, field: "date" });
    expect(validateItemDraft({ ...draft, date: "2026-02-30" })).toMatchObject({ ok: false, field: "date" });
  });

  it("rejects a start or end time that is not HH:MM", () => {
    expect(validateItemDraft({ ...draft, startTime: "9:00" })).toMatchObject({ ok: false, field: "time" });
    expect(validateItemDraft({ ...draft, startTime: "09:00", endTime: "24:00" })).toMatchObject({
      ok: false,
      field: "time",
    });
  });
});

describe("isSingleEmoji", () => {
  it("accepts one emoji, including ones built from several code points", () => {
    for (const emoji of ["🍜", "✈️", "☕️", "👨‍👩‍👧‍👦", "👍🏽", "🇯🇵", "1️⃣", "⛩️"]) {
      expect(isSingleEmoji(emoji), emoji).toBe(true);
    }
  });

  it("rejects text, several emoji, and the empty string", () => {
    for (const text of ["", "a", "가", "1", "🍜🍣", "🍜 ", "ab"]) {
      expect(isSingleEmoji(text), text).toBe(false);
    }
  });

  it("rejects a single grapheme longer than the server's 16 code point limit", () => {
    const long = "👨" + "‍👩".repeat(8);
    expect([...long].length).toBeGreaterThan(16);
    expect(isSingleEmoji(long)).toBe(false);
  });
});
