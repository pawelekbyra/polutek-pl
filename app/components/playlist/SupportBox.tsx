"use client";

import React from 'react';
import { Trophy, Loader2, ChevronDown } from '../icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SupportBoxSkeleton } from '@/components/skeletons';

type SupportBoxTranslations = {
  donate: string;
  pleaseAcceptTerms: string;
  tipTheGuy: string;
};

interface SupportBoxProps {
  t: SupportBoxTranslations;
  language: string;
  selectedCurrency: string;
  amount: number | '';
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

  return (
    <div className="bg-white border border-neutral-200 p-6 shadow-md relative overflow-hidden rounded-xl text-center">
      <div className="space-y-4 relative z-10">
        <h3 className="text-xl font-sans font-black text-neutral-900 uppercase tracking-tight flex flex-wrap items-center justify-center gap-2">
          {t.donate}
          <Trophy size={32} className="text-neutral-900" />
        </h3>

        <div className="space-y-3 text-center">
          {showTermsError && (
            <p className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest animate-bounce">
              {t.pleaseAcceptTerms}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {language === 'pl' ? `Przekaż napiwek (Min ${minAmount}.00 ${selectedCurrency})` : `Send a tip (Min ${minAmount}.00 ${selectedCurrency})`}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  value={selectedCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="h-full bg-transparent border-none pr-8 pl-4 font-mono text-xl font-bold text-neutral-400 focus:text-neutral-900 focus:ring-0 outline-none cursor-pointer appearance-none transition-colors"
                  aria-label="Select Currency"
                >
                  {availableCurrencies.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
                <div className="absolute right-4 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                   <ChevronDown size={14} />
                </div>
              </div>
              <input
                type="number"
                min={minAmount}
                step="1"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-4 px-12 font-mono text-3xl font-black text-neutral-900 text-center focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-neutral-200"
                placeholder={String(minAmount)}
              />
            </div>
            {typeof amount === 'number' && amount < minAmount && (
              <p className="font-mono text-[10px] text-destructive font-bold uppercase animate-pulse">
                {language === 'pl' ? `Błąd: Nie osiągnięto minimum (${minAmount} ${selectedCurrency})` : `Error: Minimum amount not met (${minAmount} ${selectedCurrency})`}
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={onSupport}
          disabled={isLoading || amount === '' || amount < minAmount}
          className="w-full h-12 uppercase tracking-wider text-sm"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {language === 'pl' ? "PRZETWARZANIE..." : "LOADING..."}
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
              className="border-neutral-300"
              onCheckedChange={onTermsChange}
            />
            <span className="text-neutral-500 font-sans font-medium text-[10px] tracking-tight transition-colors">
              {language === 'pl' ? (
                <>
                  Akceptuję{' '}
                  <button type="button" onClick={onOpenRegulamin} className="underline hover:text-neutral-900">Regulamin</button>
                  {' '}i{' '}
                  <button type="button" onClick={onOpenPolityka} className="underline hover:text-neutral-900">Politykę Prywatności</button>
                </>
              ) : (
                <>
                  I accept the{' '}
                  <button type="button" onClick={onOpenRegulamin} className="underline hover:text-neutral-900">Terms</button>
                  {' '}and{' '}
                  <button type="button" onClick={onOpenPolityka} className="underline hover:text-neutral-900">Privacy Policy</button>
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