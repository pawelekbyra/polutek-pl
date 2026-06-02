"use client";

import React, { useEffect, useState } from 'react';
import { Trophy, Loader2, ChevronDown, Clock } from '../icons';
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
  isPatron?: boolean;
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
  isPatron = false,
}) => {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const campaignEndDate = new Date('2026-09-30T23:59:59Z').getTime();
    const dayInMs = 1000 * 60 * 60 * 24;
    setDaysLeft(Math.max(0, Math.ceil((campaignEndDate - Date.now()) / dayInMs)));
  }, []);

  const progressPercent = 64;

  return (
    <div className={isPatron ? "bg-[#101010] border border-amber-400/30 p-6 shadow-xl relative overflow-hidden rounded-xl text-center text-white" : "bg-white border border-neutral-200 p-6 shadow-md relative overflow-hidden rounded-xl text-center"}>
      {isPatron && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-20 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-48 w-48 rounded-full bg-orange-600/20 blur-3xl" />
        </div>
      )}
      <div className="space-y-4 relative z-10">
        <h3 className={isPatron ? "text-xl font-sans font-black uppercase tracking-tight flex flex-wrap items-center justify-center gap-2 text-amber-300" : "text-xl font-sans font-black text-neutral-900 uppercase tracking-tight flex flex-wrap items-center justify-center gap-2"}>
          {isPatron ? t.secretProject : t.supportArtist}
          <Trophy size={32} className={isPatron ? "text-amber-300" : "text-neutral-900"} />
        </h3>

        {isPatron ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left">
            <div className="flex items-start justify-between gap-4">
              <p className="font-sans text-lg font-black leading-tight text-white">
                {t.crowdfundingHeadline}
              </p>
              <div className="shrink-0 rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                {progressPercent}%
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/55">
                <span>{t.crowdfundingProgress}</span>
                <span className="flex items-center gap-1 text-amber-200">
                  <Clock size={14} />
                  {daysLeft ?? '—'} {t.crowdfundingDaysLeft}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="font-sans text-[13px] leading-relaxed text-neutral-500 whitespace-pre-wrap">
              {t.donationDescription}
            </p>
          </div>
        )}

        <div className="space-y-3 text-center">
          {showTermsError && (
            <p className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest animate-bounce">
              {t.pleaseAcceptTerms}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <label className={isPatron ? "block text-xs font-semibold uppercase tracking-wider text-white/45" : "block text-xs font-semibold uppercase tracking-wider text-neutral-400"}>
              {isPatron ? t.crowdfundingAmount : (language === 'pl' ? `Kwota wsparcia (Min ${minAmount}.00 ${selectedCurrency})` : `Transaction amount (Min ${minAmount}.00 ${selectedCurrency})`)}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  value={selectedCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className={isPatron ? "h-full bg-transparent border-none pr-8 pl-4 font-mono text-xl font-bold text-white/55 focus:text-white focus:ring-0 outline-none cursor-pointer appearance-none transition-colors" : "h-full bg-transparent border-none pr-8 pl-4 font-mono text-xl font-bold text-neutral-400 focus:text-neutral-900 focus:ring-0 outline-none cursor-pointer appearance-none transition-colors"}
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
                className={isPatron ? "w-full rounded-lg border border-white/10 bg-white/10 py-4 px-12 text-center font-mono text-3xl font-black text-white outline-none transition-all placeholder:text-white/20 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/30" : "w-full bg-neutral-50 border border-neutral-200 rounded-lg py-4 px-12 font-mono text-3xl font-black text-neutral-900 text-center focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-neutral-200"}
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
          className={isPatron ? "w-full h-12 uppercase tracking-wider text-sm bg-amber-300 text-neutral-950 hover:bg-amber-200" : "w-full h-12 uppercase tracking-wider text-sm"}
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {language === 'pl' ? "PRZETWARZANIE..." : "LOADING..."}
            </>
          ) : (
            isPatron ? t.crowdfundingButton : (language === 'pl' ? 'WYŚLIJ NAPIWEK' : 'TIP THE GUY')
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
            <span className={isPatron ? "font-sans text-[10px] font-medium tracking-tight text-white/50 transition-colors" : "text-neutral-500 font-sans font-medium text-[10px] tracking-tight transition-colors"}>
              {language === 'pl' ? (
                <>
                  Akceptuję{' '}
                  <button type="button" onClick={onOpenRegulamin} className={isPatron ? "underline hover:text-white" : "underline hover:text-neutral-900"}>Regulamin</button>
                  {' '}i{' '}
                  <button type="button" onClick={onOpenPolityka} className={isPatron ? "underline hover:text-white" : "underline hover:text-neutral-900"}>Politykę Prywatności</button>
                </>
              ) : (
                <>
                  I accept the{' '}
                  <button type="button" onClick={onOpenRegulamin} className={isPatron ? "underline hover:text-white" : "underline hover:text-neutral-900"}>Terms</button>
                  {' '}and{' '}
                  <button type="button" onClick={onOpenPolityka} className={isPatron ? "underline hover:text-white" : "underline hover:text-neutral-900"}>Privacy Policy</button>
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
