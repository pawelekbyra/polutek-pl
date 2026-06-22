"use client";

import React from 'react';
import { useLanguage } from '../LanguageContext';

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white border border-neutral-300 p-8 max-w-sm w-full rounded-xl shadow-lg animate-in zoom-in-95 duration-300">
        <h3 className="text-xl font-bold text-neutral-900 tracking-tight mb-2">{t.confirmSubscribeTitle}</h3>
        <p className="text-sm text-neutral-500 mb-8">{t.confirmSubscribeText}</p>

        {errorMessage && (
          <p className="mb-4 text-xs font-medium text-red-600" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onConfirm}
            disabled={pending}
            className="bg-charcoal text-white py-2 rounded-md font-semibold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-wait"
          >
            {t.yes}
          </button>
          <button
            onClick={onDismiss}
            disabled={pending}
            className="bg-white border border-neutral-300 text-neutral-900 py-2 rounded-md font-semibold text-sm hover:bg-neutral-50 transition-all disabled:opacity-50"
          >
            {t.no}
          </button>
        </div>
      </div>
    </div>
  );
}
