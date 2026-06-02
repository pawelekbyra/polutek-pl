"use client";

import React from 'react';
import { Trophy, Loader2, ChevronDown } from '../icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface SupportBoxProps {
  t: any;
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
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-200/70 bg-white p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-fuchsia-300/20 blur-2xl" aria-hidden="true" />
      <div className="space-y-4 relative z-10">
        <h3 className="text-xl font-sans font-black text-neutral-900 uppercase tracking-tight flex flex-wrap items-center justify-center gap-2">
          <span className="-rotate-1 rounded-xl bg-gradient-to-r from-cyan-100 via-white to-fuchsia-100 px-3 py-1 shadow-sm">{t.supportArtist}</span>
          <Trophy size={32} className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]" />
        </h3>

        <div className="space-y-3 text-center">
          <p className="font-sans text-[13px] leading-relaxed text-neutral-600 whitespace-pre-wrap">
            {t.donationDescription}
          </p>

          {showTermsError && (
            <p className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest animate-bounce">
              {t.pleaseAcceptTerms}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-700/70">
              {language === 'pl' ? `Kwota wsparcia (Min ${minAmount}.00 ${selectedCurrency})` : `Transaction amount (Min ${minAmount}.00 ${selectedCurrency})`}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  value={selectedCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="h-full bg-transparent border-none pr-8 pl-4 font-mono text-xl font-bold text-cyan-700/60 focus:text-neutral-900 focus:ring-0 outline-none cursor-pointer appearance-none transition-colors"
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
                className="w-full rounded-xl border border-cyan-100 bg-gradient-to-r from-neutral-50 via-white to-fuchsia-50/50 py-4 px-12 text-center font-mono text-3xl font-black text-neutral-900 outline-none transition-all placeholder:text-neutral-200 focus:border-transparent focus:ring-2 focus:ring-cyan-400"
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
          className="h-12 w-full bg-slate-950 text-sm uppercase tracking-wider text-white shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-slate-800"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {language === 'pl' ? "PRZETWARZANIE..." : "LOADING..."}
            </>
          ) : (
            language === 'pl' ? 'WYŚLIJ NAPIWEK' : 'TIP THE GUY'
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
