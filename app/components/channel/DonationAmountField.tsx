"use client";

import { ChevronDown } from "../icons";
import type { SupportedCurrency } from "@/lib/constants";

interface DonationAmountFieldProps {
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
const labelId = "donation-amount-label";
const errorId = "donation-amount-error";

export default function DonationAmountField({
  isPl,
  amount,
  setAmount,
  minAmount,
  selectedCurrency,
  availableCurrencies,
  onCurrencyChange,
  amountTooLow,
}: DonationAmountFieldProps) {
  // Visible keyboard focus ring (the app's --chan-blue pattern): the `outline-none` below removes
  // the UA outline, so without this a keyboard user had no focus indication at all.
  const focusRing =
    "rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]";

  return (
    <div className="mb-3">
      <p id={labelId} className="mb-1.5 px-1 font-sans text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">
        {isPl ? "Wpisz kwotę napiwku" : "Enter your tip amount"}
      </p>
      <div className="rounded-[12px] bg-[var(--cm-surface-66-white)] p-[9px_14px] shadow-[inset_0_0_0_1px_var(--cm-line-86),inset_0_1px_0_rgba(255,255,255,0.5)]">
      <div className="space-y-1.5">
        <div className="relative flex items-center">
          <input
            id={inputId}
            type="number"
            min={minAmount}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            aria-labelledby={labelId}
            aria-invalid={amountTooLow}
            aria-describedby={amountTooLow ? errorId : undefined}
            placeholder={String(minAmount)}
            className={`font-sans w-full bg-transparent px-16 text-center text-[18px] font-extrabold tabular-nums text-[var(--chan-ink)] outline-none placeholder:text-[var(--chan-line-soft)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${focusRing}`}
          />
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
            <select
              value={selectedCurrency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              aria-label="Currency"
              className={`cursor-pointer appearance-none bg-transparent pr-5 font-sans text-[14px] font-bold text-[var(--chan-body)] outline-none ${focusRing}`}
            >
              {availableCurrencies.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-0 text-[var(--chan-muted)]" />
          </div>
        </div>

        {amountTooLow && (
          <p id={errorId} role="alert" className="text-[10px] font-bold uppercase tracking-wide text-destructive">
            {isPl ? `Minimum to ${minAmount} ${selectedCurrency}` : `Minimum is ${minAmount} ${selectedCurrency}`}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
