"use client";

import React from "react";
import { Trophy, Loader2, ChevronDown } from "../icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SupportBoxSkeleton } from "@/components/skeletons";

type SupportBoxTranslations = {
  donate: string;
  pleaseAcceptTerms: string;
  tipTheGuy: string;
};

interface SupportBoxProps {
  t: SupportBoxTranslations;
  language: string;
  selectedCurrency: string;
  amount: number | "";
  minAmount: number;
  isLoading: boolean;
  isTermsAccepted: boolean;
  showTermsError: boolean;
  availableCurrencies: string[];
  onAmountChange: (val: string) => void;
  onCurrencyChange: (curr: string) => void;
  onTermsChange: (checked: boolean) => void;
  onSupport: () => void;
  onOpenRegulamin: () => void;
  onOpenPolityka: () => void;
  isInitialLoading?: boolean;
}

const SupportBox: React.FC<SupportBoxProps> = ({
  t,
  language,
  selectedCurrency,
  amount,
  minAmount,
  isLoading,
  isTermsAccepted,
  showTermsError,
  availableCurrencies,
  onAmountChange,
  onCurrencyChange,
  onTermsChange,
  onSupport,
  onOpenRegulamin,
  onOpenPolityka,
  isInitialLoading = false,
}) => {
  if (isInitialLoading) return <SupportBoxSkeleton />;

  const amountInputId = "support-amount";
  const amountErrorId = "support-amount-error";
  const termsErrorId = "support-terms-error";
  const amountTooLow = typeof amount === "number" && amount < minAmount;
  const pendingLabel = language === "pl" ? "Przetwarzanie..." : "Processing...";
  const isSupportDisabled = isLoading || amount === "" || amountTooLow;

  return (
    <div
      id="support-box"
      className="bg-white border border-border p-[18px] shadow-sm relative overflow-hidden rounded-[16px] text-center"
    >
      <div className="space-y-4 relative z-10">
        <h3 className="font-heading text-[20px] font-bold text-[#0f0f0f] tracking-[-0.01em] flex flex-wrap items-center justify-center gap-2">
          {t.donate}
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white">
            <Trophy size={18} />
          </span>
        </h3>

        <div className="space-y-3 text-center">
          {showTermsError && (
            <p
              id={termsErrorId}
              role="alert"
              className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest"
            >
              {t.pleaseAcceptTerms}
            </p>
          )}

          <div className="space-y-2 pt-1">
            <label
              htmlFor={amountInputId}
              className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground"
            >
              {language === "pl"
                ? `Przekaż napiwek (Min ${minAmount}.00 ${selectedCurrency})`
                : `Send a tip (Min ${minAmount}.00 ${selectedCurrency})`}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 z-10 flex items-center">
                <select
                  value={selectedCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="h-full bg-transparent border-none pr-8 pl-4 font-brand text-[16px] font-bold text-zinc-600 focus:text-zinc-950 focus:ring-0 outline-none cursor-pointer appearance-none transition-colors"
                  aria-label="Select Currency"
                >
                  {availableCurrencies.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 pointer-events-none text-zinc-400 group-hover:text-zinc-700 transition-colors">
                  <ChevronDown size={14} />
                </div>
              </div>
              <input
                id={amountInputId}
                type="number"
                min={minAmount}
                step="1"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                aria-invalid={amountTooLow}
                aria-describedby={amountTooLow ? amountErrorId : undefined}
                className="w-full bg-zinc-50 border border-input rounded-[12px] py-4 pl-4 pr-24 font-brand text-[28px] font-extrabold text-zinc-950 text-center focus:ring-2 focus:ring-accent-ring focus:border-primary outline-none transition-all placeholder:text-zinc-300 tabular-nums"
                placeholder={String(minAmount)}
              />
            </div>
            {amountTooLow && (
              <p
                id={amountErrorId}
                role="alert"
                className="font-brand text-[10px] text-destructive font-bold uppercase tracking-wider"
              >
                {language === "pl"
                  ? `Błąd: Nie osiągnięto minimum (${minAmount} ${selectedCurrency})`
                  : `Error: Minimum amount not met (${minAmount} ${selectedCurrency})`}
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={onSupport}
          disabled={isSupportDisabled}
          aria-busy={isLoading}
          className="w-full h-[48px] rounded-[12px] bg-zinc-900 text-white uppercase tracking-wider text-sm font-bold hover:bg-zinc-800 active:scale-[0.98] transition-all"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span role="status" aria-live="polite">
                {pendingLabel}
              </span>
            </>
          ) : (
            t.tipTheGuy
          )}
        </Button>

        <div className="flex justify-center">
          <label className="flex items-center gap-2 cursor-pointer group transition-opacity">
            <Checkbox
              id="accept-terms"
              checked={isTermsAccepted}
              className="border-input data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900"
              onCheckedChange={onTermsChange}
              aria-invalid={showTermsError}
              aria-describedby={showTermsError ? termsErrorId : undefined}
            />
            <span className="text-muted-foreground font-sans font-medium text-[11px] tracking-tight transition-colors">
              {language === "pl" ? (
                <>
                  Akceptuję{" "}
                  <button
                    type="button"
                    onClick={onOpenRegulamin}
                    className="underline hover:text-zinc-950"
                  >
                    Regulamin
                  </button>{" "}
                  i{" "}
                  <button
                    type="button"
                    onClick={onOpenPolityka}
                    className="underline hover:text-zinc-950"
                  >
                    Politykę Prywatności
                  </button>
                </>
              ) : (
                <>
                  I accept the{" "}
                  <button
                    type="button"
                    onClick={onOpenRegulamin}
                    className="underline hover:text-zinc-950"
                  >
                    Terms
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={onOpenPolityka}
                    className="underline hover:text-zinc-950"
                  >
                    Privacy Policy
                  </button>
                </>
              )}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SupportBox;
