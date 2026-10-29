"use client";

import React from "react";
import { useLanguage } from "../LanguageContext";
import { LegalDocLink } from "../legal/LegalDocLink";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { txRich } from "@/lib/i18n/rich";

type EmailSubscriptionConsentModalProps = {
  open: boolean;
  pending?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
};

export default function EmailSubscriptionConsentModal({
  open,
  pending,
  errorMessage,
  onConfirm,
  onDismiss,
}: EmailSubscriptionConsentModalProps) {
  const { t, language, tx } = useLanguage();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onDismiss();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="!w-[calc(100%-2rem)] !max-w-[340px] max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-5 py-6 text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(23,23,23,0.14)] ring-0 sm:px-6 sm:py-7 motion-reduce:animate-none"
      >
        <DialogClose
          disabled={pending}
          aria-label={tx("Zamknij", "Close")}
          className="group absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] disabled:opacity-60"
        >
          <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[18px] font-black leading-none transition-colors group-hover:bg-[var(--chan-line)]">×</span>
        </DialogClose>
        <DialogHeader className="gap-3 text-center">
          <DialogTitle className="min-w-0 break-words px-6 text-balance font-brand text-2xl font-bold leading-tight tracking-tight">
            {t.confirmSubscribeTitle}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--chan-muted)]">
            {t.confirmSubscribeText}
          </DialogDescription>

        </DialogHeader>

        {errorMessage && (
          <p className="mt-4 text-xs font-medium text-red-600" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex min-h-11 items-center justify-center rounded-[12px] bg-[var(--chan-blue)] px-4 py-2 font-brand text-[15px] font-bold text-white transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_8px_20px_var(--cm-blue-25)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {t.yes}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className="flex min-h-11 items-center justify-center rounded-[12px] bg-[var(--chan-surface)] px-4 py-2 font-sans text-[14px] font-bold text-[var(--chan-ink)] transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {t.no}
          </button>
        </div>
          <p data-testid="email-consent-legal" className="mt-4 text-center text-xs leading-relaxed text-[var(--chan-muted)]">
            {txRich(
              tx,
              "Zgodę wycofasz w każdej chwili linkiem w każdej wiadomości. Szczegóły: {0} i {1}.",
              "You can withdraw consent at any time with the link in every message. Details: {0} and {1}.",
              <LegalDocLink doc="privacy" language={language}>{tx("Polityka prywatności", "Privacy Policy")}</LegalDocLink>,
              <LegalDocLink doc="terms" language={language}>{tx("Regulamin", "Terms")}</LegalDocLink>,
            )}
          </p>
      </DialogContent>
    </Dialog>
  );
}
