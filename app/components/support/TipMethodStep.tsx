"use client";

import React from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { describeTipMethod, formatTipAmount } from "./tip-flow-config";
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
 * selects; paying is the next step.
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
  return (
    <TipStepLayout
      footer={
        <TipPrimaryButton onClick={onNext} disabled={!selected}>
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

      {selected && (() => {
        const { icon: MethodIcon, title: methodTitle } = describeTipMethod(selected, tx);
        return (
          <div className="mt-5 flex items-start justify-between gap-3 rounded-[14px] border border-[var(--cm-amber-28)] bg-[var(--chan-amber-soft)] px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <p className="m-0 text-[14px] font-bold tabular-nums text-[var(--chan-ink)]">
                {tx("Napiwek", "Tip")} {formatTipAmount(amount, currency, language)}
              </p>
              <p className="m-0 text-[12px] text-[var(--chan-body)]">
                {tx("Dla:", "For:")} <span className="font-semibold text-[var(--chan-ink)]">Paweł Perfect</span>
              </p>
              <p className="m-0 flex items-center gap-1.5 text-[12px] text-[var(--chan-body)]">
                {tx("Metoda:", "Method:")}
                {MethodIcon && <MethodIcon className="h-3.5 w-3.5 shrink-0" />}
                <span className="font-semibold text-[var(--chan-ink)]">{methodTitle}</span>
              </p>
            </div>
            <button type="button" onClick={onChangeAmount} className="text-[13px] font-bold text-[var(--chan-ink)] hover:underline">
              {tx("Zmień", "Change")}
            </button>
          </div>
        );
      })()}
    </TipStepLayout>
  );
}
