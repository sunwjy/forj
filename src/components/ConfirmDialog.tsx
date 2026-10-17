"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./ConfirmDialog.module.css";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Explains what happens; extra content such as a list goes in `children`. */
  body: string;
  children?: ReactNode;
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A modal confirmation (role="alertdialog") on top of anything else open,
 * including a bottom sheet. Escape and the backdrop cancel.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  children,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      className={styles.dialog}
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      {open && (
        <div className={styles.body}>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          <p id={`${id}-body`} className={styles.text}>
            {body}
          </p>
          {children}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onCancel} autoFocus>
              취소
            </button>
            <button
              type="button"
              className={danger ? `${styles.confirm} ${styles.danger}` : styles.confirm}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
