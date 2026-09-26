"use client";

import React, { useState } from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "../icons";
import { TIP_CURRENCIES, TIP_CURRENCY_LABELS, formatTipAmount } from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

interface TipAmountStepProps {
  language: string;
  currency: SupportedCurrency;
  onCurrencyChange: (currency: SupportedCurrency) => void;
  amount: number | "";
  onAmountChange: (amount: number | "") => void;
  minAmount: number;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
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
  termsAccepted,
  onTermsChange,
  onNext,
  busy,
}: TipAmountStepProps) {
  const isPl = language === "pl";
  // The button is always active; a click with a missing/too-low amount or unticked terms
  // explains what's missing instead of continuing.
  const [attempted, setAttempted] = useState(false);
  const amountMissing = amount === "" || amount <= 0;
  const amountTooLow = !amountMissing && amount < minAmount;
  const showAmountError = amountTooLow || (attempted && amountMissing);
  const showTermsError = attempted && !termsAccepted;

  const handleNext = () => {
    setAttempted(true);
    if (amountMissing || amountTooLow || !termsAccepted || busy) return;
    onNext();
  };

  const legalLink = (key: "terms" | "privacy", label: string) => (
    <a
      href={getLocalizedHref(isPl ? "pl" : "en", key)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-[var(--chan-ink)] underline underline-offset-2 hover:text-[var(--chan-blue)]"
    >
      {label}
    </a>
  );

  return (
    <TipStepLayout
      footer={
        <>
          <label className="mb-3 flex cursor-pointer items-start gap-2.5">
            <Checkbox
              id="tip-accept-terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => onTermsChange(checked === true)}
              className="mt-[2px] shrink-0"
            />
            <span className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
              {isPl ? (
                <>Akceptuję {legalLink("terms", "Regulamin")} i {legalLink("privacy", "Politykę Prywatności")}</>
              ) : (
                <>I accept the {legalLink("terms", "Terms")} and {legalLink("privacy", "Privacy Policy")}</>
              )}
            </span>
          </label>
          {showTermsError && (
            <p role="alert" className="-mt-1 mb-3 text-[12px] font-semibold text-destructive">
              {isPl ? "Zaakceptuj Regulamin i Politykę Prywatności." : "Please accept the Terms and Privacy Policy."}
            </p>
          )}
          <TipPrimaryButton onClick={handleNext} busy={busy}>
            {busy
              ? isPl ? "Chwileczkę…" : "One moment…"
              : amountMissing || amountTooLow
                ? isPl ? "Dalej" : "Next"
                : isPl
                  ? `Dalej · ${formatTipAmount(amount, currency, language)}`
                  : `Next · ${formatTipAmount(amount, currency, language)}`}
          </TipPrimaryButton>
        </>
      }
    >
      <TipStepHeading
        title={isPl ? "Kwota napiwku" : "Tip amount"}
        subtitle={
          isPl
            ? "Napiwek jest dobrowolny i niczego nie odblokowuje. Po prostu dziękuję."
            : "A tip is voluntary and unlocks nothing. Simply: thank you."
        }
      />

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-[var(--chan-body)]">{isPl ? "Waluta" : "Currency"}</span>
        <div className="relative">
          <select
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value as SupportedCurrency)}
            className="h-12 w-full cursor-pointer appearance-none rounded-[14px] border-2 border-[var(--chan-line)] bg-white pl-4 pr-10 text-[15px] font-bold text-[var(--chan-ink)] outline-none transition-colors focus:border-[var(--chan-blue)]"
          >
            {TIP_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {isPl ? TIP_CURRENCY_LABELS[code].pl : TIP_CURRENCY_LABELS[code].en}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--chan-muted)]" />
        </div>
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[12px] font-bold text-[var(--chan-body)]">{isPl ? "Kwota" : "Amount"}</span>
        <div className="flex h-14 items-center rounded-[14px] border-2 border-[var(--chan-line)] bg-white px-4 transition-colors focus-within:border-[var(--chan-blue)]">
          <input
            type="number"
            inputMode="decimal"
            min={minAmount}
            step="1"
            value={amount}
            placeholder={String(minAmount)}
            onChange={(event) => onAmountChange(event.target.value === "" ? "" : Number(event.target.value))}
            aria-invalid={showAmountError}
            className="w-full bg-transparent text-[22px] font-extrabold tabular-nums text-[var(--chan-ink)] outline-none placeholder:font-semibold placeholder:text-[var(--chan-line-soft)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="ml-2 text-[15px] font-bold text-[var(--chan-muted)]">{currency}</span>
        </div>
      </label>
      <p role={showAmountError ? "alert" : undefined} className={showAmountError ? "mt-1.5 text-[12px] font-semibold text-destructive" : "mt-1.5 text-[12px] text-[var(--chan-muted)]"}>
        {attempted && amountMissing
          ? isPl
            ? `Wpisz kwotę napiwku (co najmniej ${formatTipAmount(minAmount, currency, language)}).`
            : `Enter a tip amount (at least ${formatTipAmount(minAmount, currency, language)}).`
          : isPl
          ? `Najmniejszy napiwek to ${formatTipAmount(minAmount, currency, language)}.`
          : `The smallest tip is ${formatTipAmount(minAmount, currency, language)}.`}
      </p>

    </TipStepLayout>
  );
}
