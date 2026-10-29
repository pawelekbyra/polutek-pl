"use client";

import React, { useEffect, useRef } from "react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import type { Tx } from "@/lib/i18n/ui";

/**
 * Top of the sign-in window, the same in every view (sign-in, sign-up, passkey, check inbox, reset,
 * two-step, expired link): the close button sits close to the card's corner with a 44 px touch target
 * (the visible circle is 32 px), and the title keeps a matching gap on both sides so a long or
 * two-line title never runs under the button.
 */
export function AuthDialogTop({
  title,
  tx,
  onClose,
  viewKey,
}: {
  title: string;
  tx: Tx;
  onClose: () => void;
  /** Changes whenever the window shows another screen; the focus then moves to the new title (WCAG 2.4.3). */
  viewKey?: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownView = useRef(viewKey);
  useEffect(() => {
    // The first view is focused by the dialog itself; later ones replace the controls that had the focus.
    if (shownView.current === viewKey) return;
    shownView.current = viewKey;
    titleRef.current?.focus({ preventScroll: true });
  }, [viewKey]);
  return (
    <>
      <CloseButton
        onClick={onClose}
        data-testid="auth-dialog-close"
        aria-label={tx("Zamknij okno logowania", "Close sign-in dialog")}
      />
      <DialogHeader className="px-9 text-center">
        <DialogTitle ref={titleRef} tabIndex={-1} className="text-balance outline-none font-brand text-2xl font-bold tracking-tight text-[var(--chan-ink)]">{title}</DialogTitle>
      </DialogHeader>
    </>
  );
}
