"use client";

import React from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { ChevronDown } from "../icons";
import { describeTipMethod, formatTipAmount } from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

interface TipMethodStepProps {
  language: string;
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
  const isPl = language === "pl";
  const selectedCopy = selected ? describeTipMethod(selected, isPl) : null;
  return (
    <TipStepLayout
      footer={
        <TipPrimaryButton onClick={onNext} disabled={!selected}>
          {isPl ? "Dalej" : "Next"}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading title={isPl ? "Metoda napiwku" : "Tip method"} />

      <div className="mb-5 flex items-center justify-between gap-3 rounded-[14px] bg-[var(--chan-amber-soft)] px-4 py-3">
        <p className="m-0 text-[14px] font-bold tabular-nums text-[var(--chan-ink)]">
          {isPl ? "Napiwek" : "Tip"} {formatTipAmount(amount, currency, language)}
        </p>
        <button type="button" onClick={onChangeAmount} className="text-[13px] font-bold text-[var(--chan-blue)] hover:underline">
          {isPl ? "Zmień" : "Change"}
        </button>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-[var(--chan-body)]">
          {isPl ? "Wybierz metodę napiwku" : "Choose a tip method"}
        </span>
        <div className="relative">
          <select
            value={selected ?? ""}
            onChange={(event) => onSelect(event.target.value)}
            className="h-12 w-full cursor-pointer appearance-none rounded-[14px] border-2 border-[var(--chan-line)] bg-white pl-4 pr-10 text-[15px] font-bold text-[var(--chan-ink)] outline-none transition-colors focus:border-[var(--chan-blue)]"
          >
            {methods.map((method) => {
              const copy = describeTipMethod(method, isPl);
              return (
                <option key={method} value={method}>
                  {copy.icon ? `${copy.icon} ${copy.title}` : copy.title}
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--chan-muted)]" />
        </div>
      </label>
      {selectedCopy && <p className="mt-1.5 text-[12px] text-[var(--chan-muted)]">{selectedCopy.hint}</p>}
    </TipStepLayout>
  );
}
