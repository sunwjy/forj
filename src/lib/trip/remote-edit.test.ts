import { describe, expect, it } from "vitest";
import type { ItemFields } from "./changes";
import { draftFromItem, itemPatch, validateItemDraft } from "./item-draft";
import { mergeRemoteFields, mergeRemoteItem } from "./remote-edit";
import { hhMm, isoDate } from "./test-values";

const opened: ItemFields = {
  date: isoDate("2026-11-20"),
  title: "라멘",
  memo: null,
  startTime: hhMm("12:00"),
  endTime: hhMm("13:00"),
  emoji: "🍜",
};

describe("mergeRemoteItem", () => {
  it("takes someone else's value for a field I have not touched", () => {
    const latest = { ...opened, title: "이치란 라멘" };
    const merged = mergeRemoteItem(opened, draftFromItem(opened), latest);
    expect(merged.draft.title).toBe("이치란 라멘");
    expect(merged.marks).toEqual({ title: "theirs" });
  });

  it("keeps my input for a field I edited that someone else also changed", () => {
    const draft = { ...draftFromItem(opened), memo: "현금 챙기기" };
    const latest = { ...opened, memo: "카드 가능" };
    const merged = mergeRemoteItem(opened, draft, latest);
    expect(merged.draft.memo).toBe("현금 챙기기");
    expect(merged.marks).toEqual({ memo: "mine" });
  });

  it("marks nothing when someone else changed nothing I can see", () => {
    const draft = { ...draftFromItem(opened), title: "내 제목" };
    const merged = mergeRemoteItem(opened, draft, { ...opened });
    expect(merged.draft).toEqual(draft);
    expect(merged.marks).toEqual({});
  });

  it("marks nothing when someone else typed what I typed", () => {
    const draft = { ...draftFromItem(opened), title: "같은 제목" };
    const merged = mergeRemoteItem(opened, draft, { ...opened, title: "같은 제목" });
    expect(merged.marks).toEqual({});
  });

  it("handles each time separately and clearing a field", () => {
    const latest = { ...opened, endTime: null, emoji: null };
    const merged = mergeRemoteItem(opened, draftFromItem(opened), latest);
    expect(merged.draft).toMatchObject({ startTime: "12:00", endTime: "", emoji: "" });
    expect(merged.marks).toEqual({ endTime: "theirs", emoji: "theirs" });
  });

  it("afterwards saves only my edits, not the values I took from someone else", () => {
    const draft = { ...draftFromItem(opened), memo: "내 메모" };
    const latest = { ...opened, title: "남이 바꾼 제목", memo: "남의 메모" };
    const merged = mergeRemoteItem(opened, draft, latest);
    const checked = validateItemDraft(merged.draft);
    if (!checked.ok) throw new Error(checked.message);
    expect(itemPatch(merged.base, checked.fields)).toEqual({ memo: "내 메모" });
  });
});

describe("mergeRemoteFields", () => {
  it("merges the trip info sheet's title and dates the same way", () => {
    const base = { title: "후쿠오카", startDate: "2026-11-20", endDate: "2026-11-23" };
    const draft = { ...base, title: "내 제목" };
    const latest = { title: "남의 제목", startDate: "2026-11-21", endDate: "2026-11-23" };
    expect(mergeRemoteFields(base, draft, latest)).toEqual({
      draft: { title: "내 제목", startDate: "2026-11-21", endDate: "2026-11-23" },
      marks: { title: "mine", startDate: "theirs" },
    });
  });
});
