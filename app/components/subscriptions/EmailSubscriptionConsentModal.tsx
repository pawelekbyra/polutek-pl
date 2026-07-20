"use client";

import React from "react";
import { useLanguage } from "../LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { t } = useLanguage();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onDismiss();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-sm gap-0 rounded-[22px] border border-[var(--chan-line)] bg-[var(--chan-card)] p-7 text-[var(--chan-ink)] shadow-[0_26px_70px_-30px_rgba(15,23,42,0.45)] motion-reduce:animate-none"
      >
        <DialogHeader className="gap-2">
          <DialogTitle className="font-sans text-xl font-bold tracking-tight">
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

        <DialogFooter className="mx-0 mb-0 mt-7 grid grid-cols-2 border-0 bg-transparent p-0">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="min-h-11 rounded-xl bg-[var(--chan-blue)] px-4 text-sm font-semibold text-white transition-[transform,background-color] duration-160 hover:bg-[var(--cm-blue-88-black)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
          >
            {t.yes}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className="min-h-11 rounded-xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-4 text-sm font-semibold text-[var(--chan-ink)] transition-colors duration-160 hover:bg-[var(--chan-surface)] disabled:opacity-50 motion-reduce:transition-none"
          >
            {t.no}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
