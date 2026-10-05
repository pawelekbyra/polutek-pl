"use client";

import React from "react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tx } from "@/lib/i18n/ui";

/**
 * Top of the sign-in window, the same in every view (sign-in, sign-up, passkey, check inbox, reset,
 * two-step, expired link): the close button sits close to the card's corner with a 44 px touch target
 * (the visible circle is 32 px), and the title keeps a matching gap on both sides so a long or
 * two-line title never runs under the button.
 */
export function AuthDialogTop({ title, tx, onClose }: { title: string; tx: Tx; onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        data-testid="auth-dialog-close"
        className="group absolute right-1.5 top-1.5 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
        aria-label={tx("Zamknij okno logowania", "Close sign-in dialog")}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[18px] font-black leading-none text-[var(--chan-ink)] transition-colors group-hover:bg-[var(--chan-line)]"
        >
          ×
        </span>
      </button>
      <DialogHeader className="px-9 text-center">
        <DialogTitle className="text-balance font-brand text-2xl font-bold tracking-tight text-[var(--chan-ink)]">{title}</DialogTitle>
      </DialogHeader>
    </>
  );
}
