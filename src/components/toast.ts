/**
 * One toast at a time, shown by the `<Toaster>` in the root layout. The store
 * lives at module level so a toast raised right before `router.push` survives
 * the client-side navigation (spec 7.1).
 */

export type ToastAction = { label: string; onClick: () => void };
export type Toast = { id: number; message: string; actions: ToastAction[] };

let current: Toast | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Shows a toast, replacing any current one. Toasts with actions stay longer. */
export function showToast(message: string, actions: ToastAction[] = []) {
  current = { id: nextId++, message, actions };
  clearTimeout(timer);
  timer = setTimeout(dismissToast, actions.length ? 6000 : 2400);
  emit();
}

export function dismissToast() {
  clearTimeout(timer);
  current = null;
  emit();
}

export function subscribeToast(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToast() {
  return current;
}
