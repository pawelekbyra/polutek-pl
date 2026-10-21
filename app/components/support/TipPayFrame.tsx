"use client";

import React from "react";
import type { Stripe } from "@stripe/stripe-js";
import type { SupportedCurrency } from "@/lib/constants";
import type { TipConfirmOutcome } from "./tip-confirm";
import { describeTipMethod, formatTipAmount } from "./tip-flow-config";
import { TipStepHeading, TipStepLayout } from "./TipStepLayout";

import { useOptionalTx } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/routing";
export interface TipPayStepProps {
  language: Locale;
  amount: number;
  currency: SupportedCurrency;
  method: string;
  clientSecret: string;
  paymentId: string | null;
  userEmail?: string;
  stripePromise: Promise<Stripe | null> | null;
  onChangeMethod: () => void;
  onConfirmed: (outcome: TipConfirmOutcome) => void;
  /**
   * patron zone (docs/architecture/patron-zone.md): the patron-zone payment reuses these forms. All
   * optional; a tip passes none of them and behaves exactly as before.
   */
  patron?: {
    /** Where redirect methods come back (instead of the tip gate's thank-you URL). */
    returnUrl: string;
    /** The two boxes under the form (Terms + Privacy Policy, immediate access). */
    consent: React.ReactNode;
    /** False until both boxes are ticked: the confirm button is disabled and a wallet button does not open. */
    accepted: boolean;
    /** Runs right before every confirmation (records the consent on the server); false aborts it. */
    beforeConfirm: () => Promise<boolean>;
  };
}

/** Heading + "20 zł · BLIK · Zmień" strip shared by every per-method form. */
export function PayStepFrame({
  props,
  footer,
  children,
}: {
  props: TipPayStepProps;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const { language, amount, currency, method, onChangeMethod } = props;
  const tx = useOptionalTx(language);
  const copy = describeTipMethod(method, tx);
  return (
    <TipStepLayout footer={footer}>
      <TipStepHeading title={copy.title} />
      <div className="mb-5 flex items-center justify-between gap-3 rounded-[14px] border border-[var(--cm-amber-28)] bg-[var(--chan-amber-soft)] px-4 py-3">
        <p className="m-0 text-[14px] font-bold text-[var(--chan-ink)]">
          <span className="tabular-nums">{formatTipAmount(amount, currency, language)}</span>
          <span className="mx-1.5 text-[var(--chan-muted)]">·</span>
          {copy.title}
        </p>
        <button type="button" onClick={onChangeMethod} className="text-[13px] font-bold text-[var(--chan-ink)] hover:underline">
          {tx("Zmień", "Change")}
        </button>
      </div>
      {children}
      {props.patron?.consent}
    </TipStepLayout>
  );
}


export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-center text-[13px] font-medium text-red-600">
      {error}
    </p>
  );
}
