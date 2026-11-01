/** The parts of an input or textarea that place the caret. */
type TextField = {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  setSelectionRange(start: number, end: number): void;
};

/**
 * Moves a caret collapsed at the very start of a non-empty field to its end.
 *
 * Base UI's Drawer takes over taps on inputs to open the iOS keyboard: it
 * cancels the tap and focuses the input from code, so the caret lands where the
 * input last had it, which is the start for a freshly mounted one. Call this on
 * focus. A mouse click places the caret again after focus, and Tab selects the
 * whole value, so neither is affected. Inputs without a caret, such as date and
 * time inputs, report a null selection and are left alone.
 */
export function moveCollapsedCaretToEnd(field: TextField): void {
  if (field.value === "" || field.selectionStart !== 0 || field.selectionEnd !== 0) return;
  field.setSelectionRange(field.value.length, field.value.length);
}
