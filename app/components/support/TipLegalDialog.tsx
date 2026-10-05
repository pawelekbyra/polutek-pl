"use client";

import React from "react";
import { Dialog, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EFFECTIVE_DATE_EN,
  PolitykaContent,
  PrivacyContentEn,
  RegulaminContent,
  TermsContentEn,
} from "../legal/LegalDocs";
import { X } from "../icons";

import { useOptionalTx } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/routing";
export type TipLegalDoc = "terms" | "privacy";

/**
 * The Terms / Privacy Policy opened from the tip gate: a second modal on top of the gate
 * (nested dialog, so Esc or ✕ closes only this one and the gate keeps its state).
 */
export function TipLegalDialog({
  doc,
  language,
  onClose,
}: {
  doc: TipLegalDoc | null;
  language: Locale;
  onClose: () => void;
}) {
  const tx = useOptionalTx(language);
  const title =
    doc === "privacy" ? (tx("Polityka Prywatności", "Privacy Policy")) : tx("Regulamin serwisu", "Terms of Service");

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="z-[9992] bg-black/30" />
        <DialogPopup className="fixed inset-x-3 bottom-3 top-[max(12px,env(safe-area-inset-top))] z-[9993] flex flex-col overflow-hidden rounded-[20px] bg-[var(--chan-card)] shadow-[0_30px_80px_-30px_rgba(23,23,23,0.5)] outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(600px,85dvh)] md:w-[560px] md:-translate-x-1/2 md:-translate-y-1/2">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--chan-line)] px-5 pb-3 pt-4">
            <div>
              <DialogTitle className="m-0 text-[20px] font-extrabold tracking-[-0.02em] text-[var(--chan-ink)]">{title}</DialogTitle>
              <p className="mt-0.5 text-[12px] text-[var(--chan-muted)]">{(tx.language === "pl") ? LEGAL_EFFECTIVE_DATE : LEGAL_EFFECTIVE_DATE_EN}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tx("Zamknij", "Close")}
              className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="tip-select-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[var(--chan-ink)]">
            {tx.language !== "pl" && tx.language !== "en" ? (
              <p className="mb-3 rounded-lg bg-[var(--chan-surface)] px-3 py-2 text-[12px] text-[var(--chan-muted)]">
                {tx("Dokument jest dostępny po polsku i angielsku.", "The document is available in English and Polish.")}
              </p>
            ) : null}
            {doc === "privacy"
              ? (tx.language === "pl") ? <PolitykaContent /> : <PrivacyContentEn />
              : (tx.language === "pl") ? <RegulaminContent /> : <TermsContentEn />}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
