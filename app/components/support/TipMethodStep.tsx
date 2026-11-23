"use client";

import React from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { PassTrustRow } from "../premium-pass/PassTrustRow";
import { describeTipMethod } from "./tip-flow-config";
import { TipRecipientCard, TipTotalBox, tipPayMode } from "./TipGateParts";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";
import { TipSelect } from "./TipSelect";

import { useOptionalTx } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/routing";
interface TipMethodStepProps {
  language: Locale;
  amount: number;
  currency: SupportedCurrency;
  /** Methods, already filtered/ordered from Stripe's `payment_method_types`. */
  methods: string[];
  selected: string | null;
  onSelect: (method: string) => void;
  onNext: () => void;
  onChangeAmount: () => void;
}

/**
 * "Metoda napiwku": a dropdown (so nothing needs scrolling) of the methods Stripe allows for
 * this intent, plus Apple Pay / Google Pay when the device has one set up. Picking only
 * selects; paying is the next step. Under it the recipient, the total (with "Zmień" back to
 * the amount) and the trust row, as in the premium checkout.
 */
export function TipMethodStep({
  language,
  amount,
  currency,
  methods,
  selected,
  onSelect,
  onNext,
  onChangeAmount,
}: TipMethodStepProps) {
  const tx = useOptionalTx(language);
  const mode = tipPayMode();
  return (
    <TipStepLayout
      bodyClassName="flex flex-col gap-[var(--pass-gap)] pt-[var(--pass-title-gap)]"
      footer={
        <TipPrimaryButton onClick={onNext} disabled={!selected} lock>
          {tx("Dalej", "Next")}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading title={tx("Metoda napiwku", "Tip method")} />

      <TipSelect
        label={tx("Wybierz metodę napiwku", "Choose a tip method")}
        value={selected}
        onChange={onSelect}
        options={methods.map((method) => ({ value: method, ...describeTipMethod(method, tx) }))}
      />

      <TipRecipientCard tx={tx} mode={mode} />
      <TipTotalBox tx={tx} language={language} amount={amount} currency={currency} onChange={onChangeAmount} />
      <PassTrustRow tx={tx} mode={mode} methods={methods} currency={currency} label={tx("Bezpieczne połączenie SSL", "Secure SSL connection")} />
    </TipStepLayout>
  );
}
