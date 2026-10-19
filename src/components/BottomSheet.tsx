"use client";

import { Drawer } from "@base-ui/react/drawer";
import type { ReactNode } from "react";
import styles from "./BottomSheet.module.css";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * A modal sheet that slides up from the bottom (spec 7). Built on Base UI's
 * Drawer, which traps focus, labels the sheet with its title, returns focus on
 * close and closes on Escape, a scrim tap or a downward swipe.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className={styles.backdrop} />
          <Drawer.Viewport className={styles.viewport}>
            <Drawer.Popup className={styles.sheet}>
              <div className={styles.header}>
                <div className={styles.grip} aria-hidden />
                <Drawer.Title className={styles.title}>{title}</Drawer.Title>
              </div>
              <Drawer.Content className={styles.body}>{children}</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
