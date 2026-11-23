"use client";

import React, { useState } from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { TIP_CURRENCIES, TIP_CURRENCY_SYMBOLS, formatTipAmount, tipCurrencyTitle } from "./tip-flow-config";
import { TipTotalBox } from "./TipGateParts";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";
import { TipSelect } from "./TipSelect";

import { useOptionalTx } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/routing";
interface TipAmountStepProps {
  language: Locale;
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
  const tx = useOptionalTx(language);
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
      bodyClassName="flex flex-col gap-[var(--pass-gap)] pt-[var(--pass-title-gap)]"
      footer={
        <TipPrimaryButton onClick={handleNext} busy={busy} lock>
          {busy
            ? tx("Chwileczkę…", "One moment…")
            : amountMissing || amountTooLow
              ? tx("Dalej", "Next")
              : tx("Dalej · {0}", "Next · {0}", formatTipAmount(amount, currency, language))}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading title={tx("Kwota napiwku", "Tip amount")} />

      <TipSelect
        label={tx("Wybierz walutę napiwku", "Choose tip currency")}
        value={currency}
        onChange={(code) => onCurrencyChange(code as SupportedCurrency)}
        options={TIP_CURRENCIES.map((code) => ({
          value: code,
          icon: TIP_CURRENCY_SYMBOLS[code],
          title: tipCurrencyTitle(tx, code),
        }))}
      />

      <label className="block">
        <span className="block text-[13px] leading-[1.55] text-[var(--chan-body)]">{tx("Wybierz kwotę napiwku", "Choose tip amount")}</span>
        <div className="mt-1 flex h-[var(--pass-input-h,56px)] items-center rounded-[14px] border-2 border-[var(--pass-field-edge,var(--pass-edge))] bg-white px-4 transition-[border-color,box-shadow] focus-within:border-[var(--pass-accent)] focus-within:shadow-[0_0_0_4px_var(--pass-field-ring)]">
          <input
            type="number"
            inputMode="decimal"
            min={minAmount}
            step="1"
            value={amount}
            placeholder={String(minAmount)}
            onChange={(event) => onAmountChange(event.target.value === "" ? "" : Number(event.target.value))}
            aria-invalid={showAmountError}
            className="w-full min-w-0 bg-transparent text-left text-[22px] font-extrabold tabular-nums text-[var(--chan-ink)] outline-none placeholder:font-semibold placeholder:text-[var(--chan-muted)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="ml-2 text-[15px] font-bold text-[var(--chan-muted)]">{currency}</span>
        </div>
      </label>

      <div className="flex min-h-[20px] items-center justify-center">
        {showAmountError && (
          <p role="alert" className="m-0 px-2 text-center text-[13px] font-semibold text-[var(--pass-err)]">
            {attempted && amountMissing
              ? tx("Wpisz kwotę napiwku (co najmniej {0}).", "Enter a tip amount (at least {0}).", formatTipAmount(minAmount, currency, language))
              : tx("Kwota jest za niska. Minimum: {0}.", "Amount too low. Minimum: {0}.", formatTipAmount(minAmount, currency, language))}
          </p>
        )}
      </div>

      <div className="mt-auto">
        <TipTotalBox tx={tx} language={language} amount={amount} currency={currency} />
      </div>
    </TipStepLayout>
  );
}
