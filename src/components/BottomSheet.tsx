"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./BottomSheet.module.css";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * A modal sheet that slides up from the bottom (spec 7). Built on `<dialog>`
 * so focus trapping and Escape come from the browser. Tapping the scrim closes it.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.body}>
        <div className={styles.grip} aria-hidden />
        <h2 className={styles.title}>{title}</h2>
        {open && children}
      </div>
    </dialog>
  );
}
