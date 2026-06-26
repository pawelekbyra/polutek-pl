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
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.div
            className="bg-white border border-neutral-300 p-8 max-w-sm w-full rounded-xl shadow-lg"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <h3 className="text-xl font-bold text-neutral-900 tracking-tight mb-2">
              {t.confirmSubscribeTitle}
            </h3>
            <p className="text-sm text-neutral-500 mb-8">
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
                className="bg-charcoal text-white py-2 rounded-md font-semibold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-wait"
              >
                {t.yes}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onDismiss}
                disabled={pending}
                className="bg-white border border-neutral-300 text-neutral-900 py-2 rounded-md font-semibold text-sm hover:bg-neutral-50 transition-all disabled:opacity-50"
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
