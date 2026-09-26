"use client";

import React from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { TIP_MESSAGE_MAX_LENGTH } from "@/lib/payments/checkout.schema";
import { cn } from "@/lib/utils";
import {
  TIP_CURRENCIES,
  TIP_CURRENCY_FLAGS,
  TIP_PRESET_EMOJI,
  formatTipAmount,
  getTipPresets,
} from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

interface TipAmountStepProps {
  language: string;
  currency: SupportedCurrency;
  onCurrencyChange: (currency: SupportedCurrency) => void;
  amount: number | "";
  onAmountChange: (amount: number | "") => void;
  minAmount: number;
  message: string;
  onMessageChange: (message: string) => void;
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
  message,
  onMessageChange,
  onNext,
  busy,
}: TipAmountStepProps) {
  const isPl = language === "pl";
  const presets = getTipPresets(currency, minAmount);
  const isPreset = typeof amount === "number" && presets.includes(amount);
  const amountTooLow = amount !== "" && amount < minAmount;
  const canContinue = amount !== "" && !amountTooLow && !busy;

  return (
    <TipStepLayout
      footer={
        <TipPrimaryButton onClick={onNext} disabled={!canContinue} busy={busy}>
          {amount === "" || amountTooLow
            ? isPl ? "Wybierz kwotę" : "Choose an amount"
            : isPl
              ? `Dalej · ${formatTipAmount(amount, currency, language)}`
              : `Next · ${formatTipAmount(amount, currency, language)}`}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading
        title={isPl ? "Ile chcesz dać?" : "How much would you like to give?"}
        subtitle={
          isPl
            ? "Napiwek jest dobrowolny i niczego nie odblokowuje. Po prostu dziękuję."
            : "A tip is voluntary and unlocks nothing. Simply: thank you."
        }
      />

      <div role="radiogroup" aria-label={isPl ? "Waluta" : "Currency"} className="mb-4 flex flex-wrap gap-1.5">
        {TIP_CURRENCIES.map((code) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={code === currency}
            onClick={() => onCurrencyChange(code)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]",
              code === currency
                ? "border-[var(--chan-ink)] bg-[var(--chan-ink)] text-white"
                : "border-[var(--chan-line)] bg-white text-[var(--chan-body)] hover:border-[var(--chan-ink)]/40",
            )}
          >
            <span aria-hidden="true">{TIP_CURRENCY_FLAGS[code]}</span>
            {code}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label={isPl ? "Kwota" : "Amount"} className="grid grid-cols-2 gap-2.5">
        {presets.map((value, index) => {
          const selected = amount === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onAmountChange(value)}
              className={cn(
                "flex h-[68px] flex-col items-center justify-center rounded-[16px] border-2 transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none",
                selected
                  ? "border-[var(--chan-amber)] bg-[var(--chan-amber-soft)]"
                  : "border-[var(--chan-line)] bg-white hover:border-[var(--cm-amber-38)]",
              )}
            >
              <span aria-hidden="true" className="text-[18px] leading-none">{TIP_PRESET_EMOJI[index] ?? "💛"}</span>
              <span className="mt-1 text-[17px] font-extrabold tabular-nums text-[var(--chan-ink)]">
                {formatTipAmount(value, currency, language)}
              </span>
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="sr-only">{isPl ? "Inna kwota" : "Custom amount"}</span>
        <div
          className={cn(
            "flex h-12 items-center rounded-[14px] border-2 bg-white px-4 transition-colors focus-within:border-[var(--chan-blue)]",
            !isPreset && amount !== "" ? "border-[var(--chan-amber)]" : "border-[var(--chan-line)]",
          )}
        >
          <input
            type="number"
            inputMode="decimal"
            min={minAmount}
            step="1"
            value={isPreset ? "" : amount}
            placeholder={isPl ? "Inna kwota" : "Other amount"}
            onChange={(event) => onAmountChange(event.target.value === "" ? "" : Number(event.target.value))}
            aria-invalid={amountTooLow}
            className="w-full bg-transparent text-[16px] font-bold tabular-nums text-[var(--chan-ink)] outline-none placeholder:font-medium placeholder:text-[var(--chan-muted)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="ml-2 text-[14px] font-bold text-[var(--chan-muted)]">{currency}</span>
        </div>
      </label>
      {amountTooLow && (
        <p role="alert" className="mt-1.5 text-[12px] font-semibold text-destructive">
          {isPl
            ? `Najmniejszy napiwek to ${formatTipAmount(minAmount, currency, language)}.`
            : `The smallest tip is ${formatTipAmount(minAmount, currency, language)}.`}
        </p>
      )}

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[12px] font-bold text-[var(--chan-body)]">
          {isPl ? "Wiadomość dla twórcy (opcjonalnie)" : "A message for the creator (optional)"}
        </span>
        <textarea
          value={message}
          maxLength={TIP_MESSAGE_MAX_LENGTH}
          rows={2}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder={isPl ? "Widzi to tylko twórca" : "Only the creator sees this"}
          className="w-full resize-none rounded-[14px] border-2 border-[var(--chan-line)] bg-white px-4 py-3 text-[14px] text-[var(--chan-ink)] outline-none transition-colors placeholder:text-[var(--chan-muted)] focus:border-[var(--chan-blue)]"
        />
        <span className="mt-1 block text-right text-[11px] tabular-nums text-[var(--chan-muted)]">
          {message.length}/{TIP_MESSAGE_MAX_LENGTH}
        </span>
      </label>
    </TipStepLayout>
  );
}
