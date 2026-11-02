"use client";

import type { ReactNode, RefObject } from "react";
import { Drawer } from "@base-ui/react/drawer";
import styles from "./notification-panel.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  /** The bell (a `Drawer.Trigger`): it stays outside the portal and gets the focus back on close. */
  trigger: ReactNode;
  initialFocus: RefObject<HTMLElement | null>;
  busy: boolean;
  /** Set when the panel is switched from the popover while already open (rotation): no slide, no flicker. */
  instant: boolean;
  /** Screen reader hint read with the dialog name. */
  hint: string;
  children: ReactNode;
};

/**
 * Bottom sheet for phones (Base UI Drawer = modal Dialog + swipe): page scroll lock, focus trap, Esc, scrim press,
 * focus return and swipe-down dismissal come from the library. The drag zone is the top part (grabber + header, children
 * mark it with `styles.sheetDrag`); the list below keeps its own scrolling. Layers sit above the top bar (z-index on the
 * portalled backdrop and viewport, as for the popover positioner).
 */
export function NotificationSheet({ open, onOpenChange, onOpenChangeComplete, trigger, initialFocus, busy, instant, hint, children }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete} modal swipeDirection="down">
      {trigger}
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className={styles.sheetBackdrop} data-instant={instant ? "" : undefined} />
          <Drawer.Viewport className={styles.sheetViewport}>
            <Drawer.Popup className={styles.sheet} role="dialog" aria-modal="true" aria-busy={busy} initialFocus={initialFocus} data-instant={instant ? "" : undefined} data-notification-sheet="">
              <Drawer.Description className="sr-only">{hint}</Drawer.Description>
              {children}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
