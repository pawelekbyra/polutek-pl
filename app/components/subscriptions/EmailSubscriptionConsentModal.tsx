"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "../LanguageContext";

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
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-[#d8d0bd]/90 bg-[#f8f3e7] p-8 shadow-[0_14px_42px_rgba(23,23,23,0.18)]"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <h3 className="mb-2 text-xl font-bold tracking-tight text-[#171717]">
              {t.confirmSubscribeTitle}
            </h3>
            <p className="mb-8 text-sm text-[#6b665d]">
              {t.confirmSubscribeText}
            </p>

            {errorMessage && (
              <p className="mb-4 text-xs font-medium text-red-600" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                disabled={pending}
                className="rounded-xl bg-[#171717] py-2 text-sm font-semibold text-[#f8f3e7] shadow-[0_6px_18px_rgba(23,23,23,0.16)] transition-all hover:bg-[#171717]/90 disabled:cursor-wait disabled:opacity-50"
              >
                {t.yes}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onDismiss}
                disabled={pending}
                className="rounded-xl border border-[#d8d0bd]/90 bg-[#f8f3e7] py-2 text-sm font-semibold text-[#171717] transition-all hover:bg-[#f1ead9] disabled:opacity-50"
              >
                {t.no}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
