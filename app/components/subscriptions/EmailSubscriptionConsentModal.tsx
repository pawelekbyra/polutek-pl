"use client";

import React, { useRef } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "../LanguageContext";
import { LegalDocLink } from "../legal/LegalDocLink";
import { BellIcon } from "../icons/MarkerBellIcons";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { txRich } from "@/lib/i18n/rich";

type EmailSubscriptionConsentModalProps = {
  open: boolean;
  pending?: boolean;
  errorMessage?: string | null;
  /** The channel being subscribed to; without it the title is generic (e.g. the prompt after sign-up). */
  channelName?: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * "Do you want to subscribe?" confirmation (also the e-mail consent). It borrows the visual language of the
 * sign-in window (AuthModal): 16px radius card, `--chan-line` border, soft shadow, 44 px round close button,
 * `font-brand` title, 44 px / 12px-radius buttons (blue primary, outlined surface-coloured secondary). On phones it
 * is a compact centred card (max 360 px, 16 px gutters), never edge to edge. The focus trap, Escape, the
 * dialog role and the aria-labelledby/-describedby wiring come from the Base UI dialog primitive.
 */
export default function EmailSubscriptionConsentModal({
  open,
  pending,
  errorMessage,
  channelName,
  onConfirm,
  onDismiss,
}: EmailSubscriptionConsentModalProps) {
  const { t, language, tx } = useLanguage();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const name = channelName?.trim();
  const title = name ? tx("Subskrybować {0}?", "Subscribe to {0}?", name) : tx("Chcesz subskrybować?", "Want to subscribe?");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onDismiss();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="motion-reduce:animate-none motion-reduce:duration-0" />
        <DialogPopup
          initialFocus={confirmRef}
          data-testid="subscribe-confirm-dialog"
          className="fixed left-1/2 top-1/2 z-[1101] max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),22.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-5 pb-5 pt-6 text-center text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(23,23,23,0.14)] outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none motion-reduce:duration-0 sm:px-6 sm:pb-6"
        >
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            data-testid="subscribe-confirm-close"
            aria-label={tx("Zamknij", "Close")}
            className="group absolute right-1.5 top-1.5 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] disabled:cursor-wait disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[18px] font-black leading-none text-[var(--chan-ink)] transition-colors group-hover:bg-[var(--chan-line)]"
            >
              ×
            </span>
          </button>

          <span
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--chan-blue-soft)] text-[var(--chan-blue)] ring-1 ring-[var(--cm-blue-14)]"
          >
            <BellIcon size={24} />
          </span>

          <DialogTitle className="mt-4 text-balance break-words px-5 font-brand text-[22px] font-bold leading-tight tracking-tight text-[var(--chan-ink)]">
            {title}
          </DialogTitle>
          <DialogDescription render={<div />} className="mt-2.5 space-y-3">
            <p className="text-balance text-[14px] leading-relaxed text-[var(--chan-body)]">
              {tx("Dostaniesz powiadomienie o nowych filmach i premierach.", "You will be notified about new videos and premieres.")}
            </p>
            <p data-testid="email-consent-legal" className="text-[12px] leading-relaxed text-[var(--chan-muted)]">
              {t.confirmSubscribeText}{" "}
              {txRich(
                tx,
                "Zgodę wycofasz w każdej chwili linkiem w każdej wiadomości. Szczegóły: {0} i {1}.",
                "You can withdraw consent at any time with the link in every message. Details: {0} and {1}.",
                <LegalDocLink doc="privacy" language={language}>{tx("Polityka prywatności", "Privacy Policy")}</LegalDocLink>,
                <LegalDocLink doc="terms" language={language}>{tx("Regulamin", "Terms")}</LegalDocLink>,
              )}
            </p>
          </DialogDescription>

          {errorMessage && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-left text-[13px] font-semibold text-red-600">
              {errorMessage}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={pending}
              aria-busy={pending || undefined}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--chan-blue)] bg-[var(--chan-blue)] font-brand text-[15px] font-bold text-white outline-none transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:bg-[var(--cm-blue-88-black)] hover:shadow-[0_8px_20px_var(--cm-blue-25)] focus-visible:ring-2 focus-visible:ring-[var(--chan-focus-ring)] focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              <span>{t.subscribe}</span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={pending}
              className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[var(--chan-line-soft)] bg-[var(--chan-surface)] font-sans text-[14px] font-bold text-[var(--chan-ink)] outline-none transition-[background-color,border-color,box-shadow,transform] duration-160 hover:border-[var(--chan-control-border)] hover:bg-[var(--chan-line)] focus-visible:ring-2 focus-visible:ring-[var(--chan-focus-ring)] focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {tx("Nie teraz", "Not now")}
            </button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
