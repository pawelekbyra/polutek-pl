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
    <div className="relative overflow-hidden rounded-[1.75rem] border border-orange-300/50 bg-[#160f2e] bg-[radial-gradient(circle_at_18%_10%,rgba(249,115,22,0.34),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(132,204,22,0.28),transparent_28%),radial-gradient(circle_at_50%_105%,rgba(124,58,237,0.38),transparent_42%)] p-6 text-center text-white shadow-[0_24px_60px_rgba(22,15,46,0.28),0_0_36px_rgba(249,115,22,0.22)]">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-lime-300/25 blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-orange-400/30 blur-2xl" aria-hidden="true" />
      <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-lime-200/80 to-transparent" aria-hidden="true" />
      <div className="space-y-4 relative z-10">
        <h3 className="text-xl font-sans font-black uppercase tracking-tight flex flex-wrap items-center justify-center gap-2 text-white">
          <span className="-rotate-2 rounded-2xl bg-gradient-to-r from-orange-400 via-amber-200 to-lime-300 px-4 py-1.5 text-[#160f2e] shadow-[0_0_22px_rgba(249,115,22,0.36)]">{t.supportArtist}</span>
          <Trophy size={32} className="text-lime-300 drop-shadow-[0_0_14px_rgba(190,242,100,0.7)]" />
        </h3>

        <div className="space-y-3 text-center">
          <p className="font-sans text-[13px] leading-relaxed text-orange-50/80 whitespace-pre-wrap">
            {t.donationDescription}
          </p>

          {showTermsError && (
            <p className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest animate-bounce">
              {t.pleaseAcceptTerms}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-lime-200/85">
              {language === 'pl' ? `Kwota wsparcia (Min ${minAmount}.00 ${selectedCurrency})` : `Transaction amount (Min ${minAmount}.00 ${selectedCurrency})`}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  value={selectedCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="h-full bg-transparent border-none pr-8 pl-4 font-mono text-xl font-bold text-orange-100/80 outline-none transition-colors focus:text-lime-100 focus:ring-0 cursor-pointer appearance-none"
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
                className="w-full rounded-2xl border border-orange-200/80 bg-gradient-to-r from-white via-orange-50 to-lime-50 py-4 px-12 text-center font-mono text-3xl font-black text-[#160f2e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_24px_rgba(249,115,22,0.18)] outline-none transition-all placeholder:text-orange-200 focus:border-transparent focus:ring-2 focus:ring-lime-300"
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
          className="h-12 w-full bg-gradient-to-r from-orange-500 via-amber-300 to-lime-400 text-sm font-black uppercase tracking-[0.18em] text-[#160f2e] shadow-[0_0_22px_rgba(249,115,22,0.45),0_0_34px_rgba(132,204,22,0.25)] hover:scale-[1.01] hover:shadow-[0_0_28px_rgba(249,115,22,0.6),0_0_44px_rgba(132,204,22,0.35)]"
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
              className="border-orange-200/70 bg-white/10"
              onCheckedChange={onTermsChange}
            />
            <span className="text-orange-50/70 font-sans font-medium text-[10px] tracking-tight transition-colors">
              {language === 'pl' ? (
                <>
                  Akceptuję{' '}
                  <button type="button" onClick={onOpenRegulamin} className="underline hover:text-lime-200">Regulamin</button>
                  {' '}i{' '}
                  <button type="button" onClick={onOpenPolityka} className="underline hover:text-lime-200">Politykę Prywatności</button>
                </>
              ) : (
                <>
                  I accept the{' '}
                  <button type="button" onClick={onOpenRegulamin} className="underline hover:text-lime-200">Terms</button>
                  {' '}and{' '}
                  <button type="button" onClick={onOpenPolityka} className="underline hover:text-lime-200">Privacy Policy</button>
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
