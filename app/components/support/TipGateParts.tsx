"use client";
// The tip gateway shares the look of the premium checkout (app/components/premium-pass): the same panel, tokens, summary
// box, recipient card (the checkout's seller card), trust row and step dots. This file holds the small parts the tip steps
// need on top of those shared components. The wording differs on purpose: a tip is a voluntary gift, never a purchase, so
// nothing here says "seller", "order" or "purchase".
import React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportedCurrency } from "@/lib/constants";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { PassPartyCard } from "../premium-pass/PassPartyCard";
import type { PassPayMode } from "../premium-pass/PassTrustRow";
import passStyles from "../premium-pass/premium-pass.module.css";
import { Check } from "../icons";
import { formatTipAmount } from "./tip-flow-config";

/** The one recipient of a tip (the card, the summary of the method step and the payment step all name them). */
export const TIP_RECIPIENT_NAME = "Paweł Perfect";

/**
 * How the gateway takes money, for the shield on the recipient card: Stripe test keys ("test": the shield says so) or live
 * keys. The publishable key is inlined at build time (a literal `process.env` read, like lib/payments/stripe-browser.ts).
 */
export function tipPayMode(): PassPayMode {
  return (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").startsWith("pk_test") ? "test" : "live";
}

/** The recipient card: the checkout's seller card, captioned "Odbiorca napiwku", with the same informative shield. */
export function TipRecipientCard({ tx, compact, mode = tipPayMode() }: { tx: Tx; compact?: boolean; mode?: PassPayMode }) {
  const badgeLabel = mode === "live" ? tx("Bezpieczna płatność", "Secure payment") : tx("Tryb testowy: bez prawdziwej płatności", "Test mode: no real payment");
  return (
    <PassPartyCard
      label={tx("Odbiorca napiwku", "Tip recipient")}
      name={TIP_RECIPIENT_NAME}
      icon={(size) => <Heart size={size} strokeWidth={1.8} focusable="false" />}
      compact={compact}
      badgeLabel={badgeLabel}
      attrs={{ "data-recipient-card": "" }}
    />
  );
}

/**
 * The summary box of the gateway: "Razem" and the amount of the tip (the checkout's blue summary row). `onChange` adds a
 * quiet "Zmień" under the amount (the method step goes back to the amount with it).
 */
export function TipTotalBox({
  tx,
  language,
  amount,
  currency,
  onChange,
  compact,
}: {
  tx: Tx;
  language: Locale;
  amount: number | "";
  currency: SupportedCurrency;
  onChange?: () => void;
  /** One slim row (the payment step, where the form needs the room). */
  compact?: boolean;
}) {
  const value = amount === "" || amount <= 0 ? "—" : formatTipAmount(amount, currency, language);
  if (compact) {
    return (
      <div className={passStyles.summaryRow} role="group" aria-label={tx("Podsumowanie napiwku", "Tip summary")}>
        <span>{tx("Razem", "Total")}</span>
        <b>{value}</b>
      </div>
    );
  }
  return (
    <div role="group" aria-label={tx("Podsumowanie napiwku", "Tip summary")}>
      <div className={cn(passStyles.order, passStyles.orderSolo)}>
        <div className={passStyles.orderSoloRow}>
          <div>
            <span className={passStyles.orderSoloLabel}>{tx("Razem", "Total")}</span>
            <span className={passStyles.orderSoloNote}>{tx("Dobrowolny napiwek", "A voluntary tip")}</span>
          </div>
          <div>
            <b className={passStyles.orderSoloPrice}>{value}</b>
            {onChange && (
              <button
                type="button"
                onClick={onChange}
                className="relative ml-auto block rounded text-[13px] font-semibold leading-4 text-[var(--chan-ink)] underline underline-offset-2 before:absolute before:-inset-x-3 before:-inset-y-3.5 before:content-[''] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pass-accent)]"
              >
                {tx("Zmień", "Change")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A pre-selected answer (nothing else to choose, "Dalej" goes on): the checkout's selected-card look, a tick in a blue ring. */
export function TipSelectedRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 rounded-[16px] border-2 border-[var(--pass-accent)] bg-[var(--pass-tint)] px-4 py-2.5 shadow-[0_12px_24px_-12px_rgba(1,40,106,0.5),0_2px_4px_-1px_rgba(1,40,106,0.12)]">
      <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--pass-accent)]">
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </span>
      <span className="text-[15px] font-bold text-[var(--chan-ink)]">{children}</span>
    </div>
  );
}

/** The quiet way out ("Nie teraz"): an underlined link, 44 px high to tap, in the body's reading colour. */
export function TipQuietLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 text-[13px] font-semibold text-[var(--chan-body)] underline underline-offset-[3px] transition-colors hover:text-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pass-accent)]"
    >
      {children}
    </button>
  );
}
