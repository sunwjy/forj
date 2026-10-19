import { Toast } from "@base-ui/react/toast";

/**
 * One toast at a time, shown by the `<Toaster>` in the root layout. The manager
 * lives at module level so a toast raised right before `router.push` survives
 * the client-side navigation (spec 7.1).
 */
export const toastManager = Toast.createToastManager();

export type ToastAction = { label: string; onClick: () => void };

let current: { id: string; message: string } | null = null;

/** Shows a toast, replacing any current one. Toasts with an action stay longer. */
export function showToast(message: string, action?: ToastAction) {
  dismissToast();
  const id = toastManager.add({
    title: message,
    timeout: action ? 6000 : 2400,
    onClose: () => {
      if (current?.id === id) current = null;
    },
    actionProps: action && {
      children: action.label,
      onClick: () => {
        toastManager.close(id);
        action.onClick();
      },
    },
  });
  current = { id, message };
}

export function dismissToast() {
  if (current) toastManager.close(current.id);
  current = null;
}

/** The toast on screen, if any. */
export function getToast() {
  return current;
}
