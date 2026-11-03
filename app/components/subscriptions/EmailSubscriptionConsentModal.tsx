"use client";

import React from "react";
import { CloseButton } from "@/components/ui/close-button";
import { useLanguage } from "../LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tidyWrap } from "@/lib/i18n/typography";
import { htmlLang } from "@/lib/i18n/ui";

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
        lang={htmlLang(language)}
        className="!w-[min(400px,calc(100vw-2rem))] !max-w-none [line-break:strict] max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-5 py-6 text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(23,23,23,0.14)] ring-0 sm:px-6 sm:py-7 motion-reduce:animate-none"
      >
        <DialogClose disabled={pending} aria-label={tx("Zamknij", "Close")} render={<CloseButton />} />
        <DialogHeader className="gap-3 text-center">
          <DialogTitle className="min-w-0 break-words px-6 text-balance font-brand text-2xl font-bold leading-tight tracking-tight">
            {tidyWrap(t.confirmSubscribeTitle, language)}
          </DialogTitle>
          <DialogDescription className="mx-auto max-w-[38ch] text-balance break-words hyphens-auto text-center text-sm leading-relaxed text-[var(--chan-muted)]">
            {tidyWrap(t.confirmSubscribeText, language, { widow: true })}
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
      </DialogContent>
    </Dialog>
  );
}
