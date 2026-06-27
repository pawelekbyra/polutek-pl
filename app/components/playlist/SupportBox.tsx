"use client";

import React from "react";
import { Loader2, ChevronDown, Heart } from "../icons";
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
  const isPl = language === "pl";

  return (
    <div
      id="support-box"
      className="border border-accent-ring bg-gradient-to-b from-accent-soft to-white rounded-[16px] p-[18px] shadow-[0_6px_22px_rgba(37,99,235,0.07)] text-center max-w-sm mx-auto"
    >
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-[4px]">
          <Heart size={20} className="text-primary fill-primary" />
          <h3 className="font-heading text-[20px] font-bold text-[#0f0f0f] m-0">
            {isPl ? "Wesprzyj twórcę" : "Support the creator"}
          </h3>
        </div>

        <p className="m-[0_0_14px] text-[13px] leading-[1.55] text-[#4a4a4a]">
          {isPl ? "Jednorazowe wsparcie odblokowuje wszystkie materiały patronów — na zawsze." : "A one-time tip unlocks every patron video — forever."}
        </p>

        <div className="space-y-3 text-center">
          {showTermsError && (
            <p
              id={termsErrorId}
              role="alert"
              className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest animate-pulse"
            >
              {t.pleaseAcceptTerms}
            </p>
          )}

          <div className="space-y-2 pt-0">
            <label
              htmlFor={amountInputId}
              className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7a7a7a]"
            >
              {isPl
                ? `KWOTA (MIN ${minAmount} ${selectedCurrency})`
                : `AMOUNT (MIN ${minAmount} ${selectedCurrency})`}
            </label>
            <div className="relative bg-white border border-accent-ring rounded-[11px] overflow-hidden">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <div className="relative flex items-center">
                    <select
                    value={selectedCurrency}
                    onChange={(e) => onCurrencyChange(e.target.value)}
                    className="bg-transparent border-none pr-6 pl-2 font-brand text-[16px] font-bold text-primary focus:ring-0 outline-none cursor-pointer appearance-none transition-colors"
                    aria-label="Select Currency"
                    >
                    {availableCurrencies.map((curr) => (
                        <option key={curr} value={curr}>
                        {curr}
                        </option>
                    ))}
                    </select>
                    <div className="absolute right-0 pointer-events-none text-primary">
                    <ChevronDown size={14} />
                    </div>
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
                className="w-full bg-transparent border-none py-3 px-4 font-brand text-[24px] font-bold text-[#1a1a1a] focus:ring-0 outline-none transition-all placeholder:text-neutral-200 tabular-nums"
                placeholder={String(minAmount)}
              />
            </div>
            {amountTooLow && (
              <p
                id={amountErrorId}
                role="alert"
                className="font-brand text-[10px] text-destructive font-bold uppercase tracking-wider"
              >
                {isPl
                  ? `MINIMUM: ${minAmount} ${selectedCurrency}`
                  : `MINIMUM: ${minAmount} ${selectedCurrency}`}
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={onSupport}
          disabled={isLoading || amount === "" || amount < minAmount}
          aria-busy={isLoading}
          className="w-full h-[48px] rounded-[11px] bg-primary text-white font-bold text-[15px] uppercase tracking-wider hover:brightness-[1.07] active:scale-[0.98] transition-all"
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

        <div className="flex justify-center pt-1">
          <label className="flex items-center gap-2 cursor-pointer group transition-opacity">
            <Checkbox
              id="accept-terms"
              checked={isTermsAccepted}
              className="border-accent-ring data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              onCheckedChange={onTermsChange}
              aria-invalid={showTermsError}
              aria-describedby={showTermsError ? termsErrorId : undefined}
            />
            <span className="text-[#7a7a7a] font-sans font-medium text-[11px] tracking-tight transition-colors">
              {isPl ? (
                <>
                  Akceptuję{" "}
                  <button
                    type="button"
                    onClick={onOpenRegulamin}
                    className="underline hover:text-[#0f0f0f]"
                  >
                    Regulamin
                  </button>{" "}
                  i{" "}
                  <button
                    type="button"
                    onClick={onOpenPolityka}
                    className="underline hover:text-[#0f0f0f]"
                  >
                    Politykę
                  </button>
                </>
              ) : (
                <>
                  I accept the{" "}
                  <button
                    type="button"
                    onClick={onOpenRegulamin}
                    className="underline hover:text-[#0f0f0f]"
                  >
                    Terms
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={onOpenPolityka}
                    className="underline hover:text-[#0f0f0f]"
                  >
                    Privacy
                  </button>
                </>
              )}
            </span>
          </label>
        </div>
        <div className="text-[10px] text-[#9a958b] italic">
            {isPl ? "Jednorazowo · dostęp dożywotni" : "One-time · lifetime access"}
        </div>
      </div>
    </div>
  );
};

export default SupportBox;
