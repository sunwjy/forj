import { describe, expect, it } from "vitest";
import { moveCollapsedCaretToEnd } from "./caret";

function field(value: string, selectionStart: number | null, selectionEnd: number | null = selectionStart) {
  const f = {
    value,
    selectionStart,
    selectionEnd,
    setSelectionRange(start: number, end: number) {
      f.selectionStart = start;
      f.selectionEnd = end;
    },
  };
  return f;
}

describe("moveCollapsedCaretToEnd", () => {
  it("moves a caret at the start of a filled field to its end", () => {
    const f = field("이치란 라멘", 0);
    moveCollapsedCaretToEnd(f);
    expect([f.selectionStart, f.selectionEnd]).toEqual([6, 6]);
  });

  it("keeps a caret the user placed elsewhere", () => {
    const f = field("이치란 라멘", 2);
    moveCollapsedCaretToEnd(f);
    expect([f.selectionStart, f.selectionEnd]).toEqual([2, 2]);
  });

  it("keeps a whole-value selection, as Tab makes", () => {
    const f = field("이치란 라멘", 0, 6);
    moveCollapsedCaretToEnd(f);
    expect([f.selectionStart, f.selectionEnd]).toEqual([0, 6]);
  });

  it("leaves an empty field alone", () => {
    const f = field("", 0);
    moveCollapsedCaretToEnd(f);
    expect([f.selectionStart, f.selectionEnd]).toEqual([0, 0]);
  });

  it("leaves inputs without a caret alone", () => {
    const f = field("2026-11-20", null);
    moveCollapsedCaretToEnd(f);
    expect([f.selectionStart, f.selectionEnd]).toEqual([null, null]);
  });
});
