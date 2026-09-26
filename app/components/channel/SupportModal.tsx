"use client";

import React from "react";
import { X } from "../icons";
import { Dialog, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import DonationBox from "./DonationBox";

interface SupportModalProps {
  videoTitle?: string;
  onClose: () => void;
}

/**
 * Full-page, two-step support modal (TEMP_SUPPORT_AS_MODAL experiment, see
 * lib/temp-support-modal.ts). Step 1 is the tip gate's amount step (DonationBox in its
 * "modal" variant — same fields, terms checkbox and checkout flow as the sidebar box);
 * continuing opens step 2, the existing full-page Stripe CheckoutModal, on top. Closing
 * step 2 before paying returns to this step. Mounted only while open, so every opening
 * starts from a clean form.
 */
export default function SupportModal({ videoTitle, onClose }: SupportModalProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";

  return (
    // `disablePointerDismissal`: the popup covers the whole viewport anyway, and Stripe's 3DS/
    // wallet overlays (appended to <body> during step 2) must never count as outside presses.
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} disablePointerDismissal>
      <DialogPortal>
        <DialogOverlay className="z-[9990]" />
        <DialogPopup
          data-testid="support-modal"
          className="fixed left-0 top-0 z-[9991] flex h-[100dvh] w-screen flex-col overflow-y-auto bg-[var(--chan-nav)] bg-[radial-gradient(circle_at_top_left,var(--cm-amber-8),transparent_40%),radial-gradient(circle_at_top_right,var(--cm-blue-9),transparent_36%)] pb-[env(safe-area-inset-bottom)] outline-none"
        >
          <DialogTitle className="sr-only">{isPl ? "Wesprzyj twórcę" : "Support the creator"}</DialogTitle>

          <div className="flex w-full shrink-0 items-center justify-between px-4 pt-4 md:px-8 md:pt-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--chan-muted)]">
              {isPl ? "Krok 1 z 2" : "Step 1 of 2"}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={isPl ? "Zamknij" : "Close"}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--chan-line)] bg-white text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 md:items-center md:px-8 md:pt-0">
            <div className="w-full max-w-[440px] rounded-[24px] border border-[var(--cm-amber-38)] bg-[linear-gradient(168deg,var(--chan-amber-soft),var(--cm-card-92-white)_62%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_50px_-26px_var(--cm-amber-58)] md:p-8">
              <DonationBox videoTitle={videoTitle} variant="modal" />
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
