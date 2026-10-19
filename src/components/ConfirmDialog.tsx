"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef, type ReactNode } from "react";
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
 * A modal confirmation (Base UI's AlertDialog, role="alertdialog") on top of
 * anything else open, including a bottom sheet. Escape cancels; the backdrop
 * does not, so the choice is always explicit. Focus starts on 「취소」.
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialog.Portal>
        {/* Rendered over a sheet too; nested dialogs skip their backdrop by default. */}
        <AlertDialog.Backdrop className={styles.backdrop} forceRender />
        <AlertDialog.Popup className={styles.dialog} initialFocus={cancelRef}>
          <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
          <AlertDialog.Description className={styles.text}>{body}</AlertDialog.Description>
          {children}
          <div className={styles.actions}>
            <AlertDialog.Close ref={cancelRef} className={styles.cancel}>
              취소
            </AlertDialog.Close>
            <button
              type="button"
              className={danger ? `${styles.confirm} ${styles.danger}` : styles.confirm}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
