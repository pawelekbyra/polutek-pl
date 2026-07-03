"use client";

import { ChevronDown } from "../icons";
import { Frame, INK } from "../najs/primitives";
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
    <div className="relative mb-[12px] p-[10px_12px]">
      <Frame radius={11} seed={14} stroke={INK} strokeWidth={1} fill="#f8f3e7" />
      <div className="relative z-10 space-y-1.5">
        <label htmlFor={viewerIsPatron ? inputId : undefined} className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7a7a7a]">
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
              className="w-full bg-transparent px-16 text-center text-[26px] font-extrabold tabular-nums text-[#0f0f0f] outline-none placeholder:text-[#c9c4b8]"
              style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
            />
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
              {currencySelect("cursor-pointer appearance-none bg-transparent pr-5 text-[14px] font-bold text-[#4a4a4a] outline-none")}
              <ChevronDown size={13} className="pointer-events-none absolute right-0 text-[#9a958b]" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="text-[26px] font-extrabold tabular-nums text-[#0f0f0f]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
              {minAmount}
            </span>
            {currencySelect("cursor-pointer appearance-none bg-transparent text-[14px] font-bold text-[#4a4a4a] outline-none")}
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
