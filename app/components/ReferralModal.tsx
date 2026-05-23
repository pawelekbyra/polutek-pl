"use client";

import React, { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { X, Copy, Check } from './icons';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string;
  referralPoints: number;
}

export default function ReferralModal({ isOpen, onClose, referralCode, referralPoints }: ReferralModalProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const referralLink = `https://polutek.pl/?ref=${referralCode}`;
  const progress = Math.min((referralPoints / 5) * 100, 100);
  const missingCount = Math.max(5 - referralPoints, 0);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#F5F2ED] border border-[#1a1a1a] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-sm relative animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-[#F5F2ED] border-b border-[#1a1a1a] p-4 flex justify-between items-center z-20">
          <h2 className="font-mono font-black text-xl uppercase tracking-tighter text-black">
            {t.noMoneyTitle}
          </h2>
          <button onClick={onClose} className="hover:rotate-90 transition-transform p-1">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-8 font-serif">
          {/* Subtitle / Intro */}
          <p className="text-lg leading-relaxed font-bold italic border-l-4 border-black pl-4 py-2">
            {t.noMoneySub}
          </p>

          {/* Section: What's this? */}
          <div className="space-y-3">
            <h3 className="font-mono font-black uppercase text-sm tracking-widest text-black/40">
              {t.noMoneyHowTitle}
            </h3>
            <p className="text-sm leading-relaxed text-black/80">
              {t.noMoneyHowText}
            </p>
          </div>

          {/* Section: How to do it? */}
          <div className="space-y-4">
            <h3 className="font-mono font-black uppercase text-sm tracking-widest text-black/40">
              {t.noMoneyStepTitle}
            </h3>
            <ul className="space-y-4">
              {[t.noMoneyStep1, t.noMoneyStep2, t.noMoneyStep3, t.noMoneyStep4].map((step, i) => (
                <li key={i} className="flex gap-4 items-start">
                  <span className="font-mono font-black text-xs bg-black text-white w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{step}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Referral Link Area */}
          <div className="space-y-3 pt-4">
            <h3 className="font-mono font-black uppercase text-sm tracking-widest text-black/40">
              {t.noMoneyLinkLabel}
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 font-mono text-xs bg-black/5 border border-black/10 p-4 break-all select-all">
                {referralLink}
              </div>
              <button
                onClick={copyToClipboard}
                className="bg-black text-white px-6 py-3 font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {t.noMoneyCopy}
              </button>
            </div>
          </div>

          {/* Progress Area */}
          <div className="space-y-4 pt-4 border-t border-black/10">
            <div className="flex justify-between items-end">
                <h3 className="font-mono font-black uppercase text-sm tracking-widest text-black/40">
                {t.noMoneyProgress}
                </h3>
                <span className="font-mono font-black text-lg">{referralPoints} / 5</span>
            </div>

            <div className="h-6 w-full border border-[#1a1a1a] bg-white overflow-hidden p-0.5">
                <div
                    className="h-full bg-black transition-all duration-1000 ease-out flex items-center justify-end px-2"
                    style={{ width: `${progress}%` }}
                >
                    {progress > 10 && <span className="text-[10px] font-mono font-black text-white uppercase">{Math.round(progress)}%</span>}
                </div>
            </div>

            <p className="text-xs font-mono font-bold text-black/60 italic uppercase">
              ({t.noMoneyMissing.replace('{count}', missingCount.toString())})
            </p>
          </div>

          {/* Fine Print */}
          <div className="space-y-4 pt-6 bg-black/[0.03] p-6 border border-black/5">
            <h4 className="font-mono font-black uppercase text-[10px] tracking-[0.2em] text-black/40">
              {t.noMoneyFinePrintTitle}
            </h4>
            <div className="space-y-2">
              <p className="text-[11px] leading-tight text-black/60">• {t.noMoneyFinePrint1}</p>
              <p className="text-[11px] leading-tight text-black/60">• {t.noMoneyFinePrint2}</p>
            </div>
          </div>

          {/* Footer Text */}
          <div className="text-center pt-4 pb-2">
            <p className="font-serif italic text-sm opacity-60">
              {t.noMoneyThanks}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
