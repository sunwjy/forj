"use client";

import { Toast } from "@base-ui/react/toast";
import styles from "./Toaster.module.css";
import { toastManager } from "./toast";

/**
 * Renders the current toast (design spec 4.8). Mounted once in the root layout.
 * Base UI's viewport announces toasts politely and is a landmark that F6 jumps to,
 * so the action can be reached from the keyboard.
 */
export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className={styles.region} aria-label="알림">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className={styles.toast}>
      <Toast.Content className={styles.content}>
        <Toast.Title className={styles.message} />
        <Toast.Action className={styles.action} />
      </Toast.Content>
    </Toast.Root>
  ));
}
