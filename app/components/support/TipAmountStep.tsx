"use client";

import React, { useState } from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { TIP_CURRENCIES, TIP_CURRENCY_LABELS, formatTipAmount } from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";
import { TipSelect } from "./TipSelect";

interface TipAmountStepProps {
  language: string;
  currency: SupportedCurrency;
  onCurrencyChange: (currency: SupportedCurrency) => void;
  amount: number | "";
  onAmountChange: (amount: number | "") => void;
  minAmount: number;
  onNext: () => void;
  busy?: boolean;
}

export function TipAmountStep({
  language,
  currency,
  onCurrencyChange,
  amount,
  onAmountChange,
  minAmount,
  onNext,
  busy,
}: TipAmountStepProps) {
  const isPl = language === "pl";
  const [attempted, setAttempted] = useState(false);
  const amountMissing = amount === "" || amount <= 0;
  const amountTooLow = !amountMissing && amount < minAmount;
  const showAmountError = amountTooLow || (attempted && amountMissing);

  const handleNext = () => {
    setAttempted(true);
    if (amountMissing || amountTooLow || busy) return;
    onNext();
  };

  return (
    <TipStepLayout
      bodyClassName="flex flex-col pb-0"
      footer={
        <TipPrimaryButton onClick={handleNext} busy={busy}>
          {busy
            ? isPl ? "Chwileczkę…" : "One moment…"
            : amountMissing || amountTooLow
              ? isPl ? "Dalej" : "Next"
              : isPl
                ? `Dalej · ${formatTipAmount(amount, currency, language)}`
                : `Next · ${formatTipAmount(amount, currency, language)}`}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading title={isPl ? "Kwota napiwku" : "Tip amount"} />

      <TipSelect
        label={isPl ? "Wybierz walutę napiwku" : "Choose tip currency"}
        value={currency}
        onChange={(code) => onCurrencyChange(code as SupportedCurrency)}
        options={TIP_CURRENCIES.map((code) => ({
          value: code,
          icon: TIP_CURRENCY_LABELS[code].symbol,
          title: isPl ? TIP_CURRENCY_LABELS[code].pl : TIP_CURRENCY_LABELS[code].en,
        }))}
      />

      <label className="mt-1 block">
        <span className="mb-1 block text-[13px] leading-[1.55] text-[var(--chan-body)]">{isPl ? "Wybierz kwotę napiwku" : "Choose tip amount"}</span>
        <div className="flex h-14 items-center rounded-[14px] border-2 border-[var(--cm-amber-38)] bg-white px-4 transition-[border-color,box-shadow] focus-within:border-[var(--chan-ink)] focus-within:shadow-[0_0_0_4px_var(--cm-amber-18)]">
          <input
            type="number"
            inputMode="decimal"
            min={minAmount}
            step="1"
            value={amount}
            placeholder={String(minAmount)}
            onChange={(event) => onAmountChange(event.target.value === "" ? "" : Number(event.target.value))}
            aria-invalid={showAmountError}
            className="w-full min-w-0 bg-transparent text-left text-[22px] font-extrabold tabular-nums text-[var(--chan-ink)] outline-none placeholder:font-semibold placeholder:text-[var(--cm-amber-46)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="ml-2 text-[15px] font-bold text-[var(--chan-muted)]">{currency}</span>
        </div>
      </label>
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="shrink-0 h-[22px] flex items-center justify-center">
          {showAmountError && (
            <p role="alert" className="px-2 text-center text-[12px] font-semibold text-destructive">
              {attempted && amountMissing
                ? isPl
                  ? `Wpisz kwotę napiwku (co najmniej ${formatTipAmount(minAmount, currency, language)}).`
                  : `Enter a tip amount (at least ${formatTipAmount(minAmount, currency, language)}).`
                : isPl
                ? `Kwota jest za niska. Minimum: ${formatTipAmount(minAmount, currency, language)}.`
                : `Amount too low. Minimum: ${formatTipAmount(minAmount, currency, language)}.`}
            </p>
          )}
        </div>
        <div className="relative flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tip-character-3.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-contain" />
        </div>
      </div>
    </TipStepLayout>
  );
}
