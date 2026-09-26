"use client";

import React from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { describeTipMethod, formatTipAmount } from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

interface TipMethodStepProps {
  language: string;
  amount: number;
  currency: SupportedCurrency;
  /** Tiles, already filtered/ordered from Stripe's `payment_method_types`. */
  methods: string[];
  selected: string | null;
  onSelect: (method: string) => void;
  onNext: () => void;
  onChangeAmount: () => void;
}

/**
 * "Metoda napiwku": one tile per method Stripe allows for this intent, plus Apple Pay /
 * Google Pay when the device has one set up. Picking only selects; paying is the next step.
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

      <div role="radiogroup" aria-label={isPl ? "Metoda napiwku" : "Tip method"} className="flex flex-col gap-2.5">
        {methods.map((method) => {
          const copy = describeTipMethod(method, isPl);
          const isSelected = method === selected;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(method)}
              className={cn(
                "flex min-h-[60px] items-center gap-4 rounded-[16px] border-2 px-4 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none",
                isSelected
                  ? "border-[var(--chan-amber)] bg-[var(--chan-amber-soft)]"
                  : "border-[var(--chan-line)] bg-white hover:border-[var(--cm-amber-38)]",
              )}
            >
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[20px]">
                {copy.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-[var(--chan-ink)]">{copy.title}</span>
                <span className="block text-[12px] text-[var(--chan-muted)]">{copy.hint}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  isSelected ? "border-[var(--chan-amber)] bg-[var(--chan-amber)]" : "border-[var(--chan-line)]",
                )}
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
            </button>
          );
        })}
      </div>
    </TipStepLayout>
  );
}
