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
    <div className="relative overflow-hidden rounded-[2rem] border border-[#d8c3a2] bg-[#fff7e8] bg-[radial-gradient(circle_at_16%_0%,rgba(181,139,88,0.24),transparent_30%),radial-gradient(circle_at_88%_16%,rgba(47,111,85,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(246,232,208,0.62))] p-6 text-center text-[#173b34] shadow-[0_22px_55px_rgba(60,42,27,0.16)]">
      <div className="absolute -right-10 top-8 h-24 w-24 rounded-full border border-[#b58b58]/25 bg-[#f2d6a2]/35" aria-hidden="true" />
      <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-[#2f6f55]/10" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 h-2 w-full bg-[repeating-linear-gradient(90deg,#173b34_0_18px,#b58b58_18px_36px,#efe0c6_36px_54px)] opacity-80" aria-hidden="true" />
      <div className="space-y-4 relative z-10">
        <h3 className="text-xl font-sans font-black uppercase tracking-tight flex flex-wrap items-center justify-center gap-2 text-[#173b34]">
          <span className="-rotate-1 rounded-[1.25rem] border border-[#173b34]/10 bg-white/65 px-4 py-1.5 shadow-[0_8px_0_rgba(181,139,88,0.18)] backdrop-blur">{t.supportArtist}</span>
          <Trophy size={32} className="text-[#b58b58] drop-shadow-[0_3px_0_rgba(23,59,52,0.16)]" />
        </h3>

        <div className="space-y-3 text-center">
          <p className="font-sans text-[13px] leading-relaxed text-[#4b635c] whitespace-pre-wrap">
            {t.donationDescription}
          </p>

          {showTermsError && (
            <p className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest animate-bounce">
              {t.pleaseAcceptTerms}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-[#8a4f2c]">
              {language === 'pl' ? `Kwota wsparcia (Min ${minAmount}.00 ${selectedCurrency})` : `Transaction amount (Min ${minAmount}.00 ${selectedCurrency})`}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  value={selectedCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="h-full cursor-pointer appearance-none border-none bg-transparent pr-8 pl-4 font-mono text-xl font-black text-[#8a4f2c] outline-none transition-colors focus:text-[#173b34] focus:ring-0"
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
                className="w-full rounded-[1.35rem] border border-[#d7c4a5] bg-white/85 py-4 px-12 text-center font-mono text-3xl font-black text-[#173b34] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_0_rgba(181,139,88,0.12)] outline-none transition-all placeholder:text-[#d7c4a5] focus:border-transparent focus:ring-2 focus:ring-[#b58b58]"
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
          className="h-12 w-full bg-[#173b34] text-sm font-black uppercase tracking-[0.18em] text-[#fff7e8] shadow-[0_10px_0_rgba(181,139,88,0.28)] hover:-translate-y-0.5 hover:bg-[#214d43] hover:shadow-[0_12px_0_rgba(181,139,88,0.34)]"
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
              className="border-[#b58b58]/60 bg-white/70"
              onCheckedChange={onTermsChange}
            />
            <span className="text-[#4b635c] font-sans font-medium text-[10px] tracking-tight transition-colors">
              {language === 'pl' ? (
                <>
                  Akceptuję{' '}
                  <button type="button" onClick={onOpenRegulamin} className="underline hover:text-[#173b34]">Regulamin</button>
                  {' '}i{' '}
                  <button type="button" onClick={onOpenPolityka} className="underline hover:text-[#173b34]">Politykę Prywatności</button>
                </>
              ) : (
                <>
                  I accept the{' '}
                  <button type="button" onClick={onOpenRegulamin} className="underline hover:text-[#173b34]">Terms</button>
                  {' '}and{' '}
                  <button type="button" onClick={onOpenPolityka} className="underline hover:text-[#173b34]">Privacy Policy</button>
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
