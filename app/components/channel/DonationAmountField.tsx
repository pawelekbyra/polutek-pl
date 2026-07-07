"use client";

import { ChevronDown } from "../icons";
import type { SupportedCurrency } from "@/lib/constants";

interface DonationAmountFieldProps {
  viewerIsPatron: boolean;
  isPl: boolean;
  amount: number | "";
  setAmount: (value: number | "") => void;
  minAmount: number;
  selectedCurrency: string;
  availableCurrencies: SupportedCurrency[];
  onCurrencyChange: (currency: string) => void;
  amountTooLow: boolean;
}

const inputId = "donation-amount";
const errorId = "donation-amount-error";

export default function DonationAmountField({
  viewerIsPatron,
  isPl,
  amount,
  setAmount,
  minAmount,
  selectedCurrency,
  availableCurrencies,
  onCurrencyChange,
  amountTooLow,
}: DonationAmountFieldProps) {
  const currencySelect = (className: string) => (
    <select
      value={selectedCurrency}
      onChange={(e) => onCurrencyChange(e.target.value)}
      aria-label="Currency"
      className={className}
    >
      {availableCurrencies.map((curr) => (
        <option key={curr} value={curr}>
          {curr}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mb-3 rounded-[11px] bg-[var(--chan-surface)] p-[10px_12px]">
      <div className="space-y-1.5">
        <label htmlFor={viewerIsPatron ? inputId : undefined} className="block font-sans text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--chan-muted)]">
          {viewerIsPatron
            ? (isPl ? `Dowolna kwota (min. ${minAmount} ${selectedCurrency})` : `Any amount (min. ${minAmount} ${selectedCurrency})`)
            : (isPl ? "Kwota wsparcia" : "Support amount")}
        </label>

        {viewerIsPatron ? (
          <div className="relative flex items-center">
            <input
              id={inputId}
              type="number"
              min={minAmount}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              aria-invalid={amountTooLow}
              aria-describedby={amountTooLow ? errorId : undefined}
              placeholder={String(minAmount)}
              className="font-brand w-full bg-transparent px-16 text-center text-[26px] font-extrabold tabular-nums text-[var(--chan-ink)] outline-none placeholder:text-[var(--chan-line-soft)]"
            />
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
              {currencySelect("cursor-pointer appearance-none bg-transparent pr-5 font-sans text-[14px] font-bold text-[var(--chan-body)] outline-none")}
              <ChevronDown size={13} className="pointer-events-none absolute right-0 text-[var(--chan-muted)]" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="font-brand text-[26px] font-extrabold tabular-nums text-[var(--chan-ink)]">
              {minAmount}
            </span>
            {currencySelect("cursor-pointer appearance-none bg-transparent font-sans text-[14px] font-bold text-[var(--chan-body)] outline-none")}
          </div>
        )}

        {viewerIsPatron && amountTooLow && (
          <p id={errorId} role="alert" className="text-[10px] font-bold uppercase tracking-wide text-destructive">
            {isPl ? `Minimum to ${minAmount} ${selectedCurrency}` : `Minimum is ${minAmount} ${selectedCurrency}`}
          </p>
        )}
      </div>
    </div>
  );
}
