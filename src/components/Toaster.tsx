"use client";

import { useSyncExternalStore } from "react";
import styles from "./Toaster.module.css";
import { dismissToast, getToast, subscribeToast } from "./toast";

/** Renders the current toast (design spec 4.8). Mounted once in the root layout. */
export function Toaster() {
  const toast = useSyncExternalStore(subscribeToast, getToast, () => null);
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={styles.toast}>
          <span className={styles.message}>{toast.message}</span>
          {toast.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={styles.action}
              onClick={() => {
                dismissToast();
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
