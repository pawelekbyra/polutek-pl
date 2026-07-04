"use client";

import React from 'react';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { Frame, INK, BLUE } from '../najs/primitives';
import BrandName from '../BrandName';

interface CheckoutSummaryPanelProps {
  language: string;
  amount: number | '';
  selectedCurrency: string;
  videoTitle?: string;
  viewerIsPatron: boolean;
}

// Hand-drawn "heart in an open hand" — the support mark for the payment screen, in the site's
// cienkopis style: ink outline, brand-blue filled heart, a few motion sparks.
function SupportHandDrawing() {
  return (
    <svg viewBox="0 0 200 150" className="mx-auto h-auto w-[min(240px,70%)]" aria-hidden="true">
      {/* sparks */}
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".65" fill="none">
        <path d="M 38 34 L 30 24" />
        <path d="M 100 16 L 100 5" />
        <path d="M 162 34 L 170 24" />
        <path d="M 55 20 L 50 12" />
        <path d="M 146 20 L 151 12" />
      </g>
      {/* heart — brand blue fill, bold ink outline, slightly tilted for the hand-drawn feel */}
      <g transform="rotate(-4 100 62)">
        <path
          d="M100 96 C 100 96 62 70 61 47 C 60.5 34 70 26 81 26.5 C 89 27 96 32 99.5 39 C 103 32 110 26.5 118 26 C 129 25.5 139.5 33 139 46 C 138 70 100 96 100 96 Z"
          fill={BLUE}
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* highlight stroke inside the heart */}
        <path d="M 76 40 C 74 44 74 49 77 54" fill="none" stroke="#f7f1e4" strokeWidth="3" strokeLinecap="round" opacity=".85" />
      </g>
      {/* open hand cradling the heart */}
      <g fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        {/* palm line */}
        <path d="M 52 104 C 68 116 132 116 148 104" />
        {/* thumb + wrist left */}
        <path d="M 52 104 C 46 98 44 90 48 84 C 52 78 60 79 63 86" />
        <path d="M 148 104 C 154 98 156 90 152 84 C 148 78 140 79 137 86" />
        {/* wrist */}
        <path d="M 74 113 C 74 124 72 132 68 140" />
        <path d="M 126 113 C 126 124 128 132 132 140" />
      </g>
    </svg>
  );
}

/**
 * Left-hand summary panel of the desktop checkout — designed from scratch in the site's
 * paper + fineliner language (replaces the old dark gradient billboard).
 */
export default function CheckoutSummaryPanel({
  language,
  amount,
  selectedCurrency,
  videoTitle,
  viewerIsPatron,
}: CheckoutSummaryPanelProps) {
  const isPl = language === 'pl';

  const heading = viewerIsPatron
    ? (isPl ? 'Dzięki, że wspierasz dalej' : 'Thanks for supporting again')
    : (isPl ? 'Zostajesz Patronem Projektu' : 'You are becoming a Project Patron');

  const lead = viewerIsPatron
    ? (isPl
        ? 'Masz już dożywotni dostęp do Strefy Fenkju — ta wpłata niczego nie odblokowuje. To czysty gest wsparcia i realne paliwo dla kanału.'
        : 'You already hold lifetime access to the Thank You Zone — this tip unlocks nothing new. It is pure support and real fuel for the channel.')
    : (isPl
        ? 'Jedna wpłata — i Strefa Fenkju jest Twoja na zawsze: wszystkie obecne i przyszłe materiały dodatkowe. Bez subskrypcji, bez ukrytych kosztów.'
        : 'One payment — and the Thank You Zone is yours for good: every current and future bonus. No subscription, no hidden costs.');

  const bullets: { text: string; soft?: boolean }[] = viewerIsPatron
    ? [
        { text: isPl ? 'Dostęp masz już zapewniony' : 'Your access is already secured' },
        { text: isPl ? 'Dowolna kwota — bez nowych obietnic' : 'Any amount — no new promises' },
        { text: isPl ? 'Całość idzie w rozwój kanału' : 'Everything goes into the channel', soft: true },
      ]
    : [
        { text: isPl ? 'Dożywotni dostęp do Strefy Fenkju' : 'Lifetime access to the Thank You Zone' },
        { text: isPl ? 'Jedna wpłata, zero subskrypcji' : 'One payment, zero subscriptions' },
        { text: isPl ? 'Napędzasz kolejne materiały' : 'You power the next videos', soft: true },
      ];

  return (
    <div className="relative hidden h-full flex-col justify-between overflow-hidden border-r border-[#d8d0bd] bg-[#f1ead9] px-10 py-10 text-[#171717] md:flex md:w-[45%] lg:px-14">
      {/* faint grid, same as the splash screen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(18,18,18,0.06) 1px, transparent 1px), linear-gradient(rgba(18,18,18,0.06) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />

      {/* brand */}
      <div className="relative z-10">
        <BrandName
          className="text-[22px] leading-none"
          variant="classic"
          style={{ fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}
        />
      </div>

      {/* centre: drawing + message + amount */}
      <div className="relative z-10 my-6 flex flex-col gap-7">
        <SupportHandDrawing />

        <div>
          <h1
            className="m-0 text-[30px] font-bold leading-[1.15] lg:text-[34px]"
            style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
          >
            <span
              className="px-[4px]"
              style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(251,224,138,0.72) 55%, rgba(251,224,138,0.72) 94%, transparent 94%)' }}
            >
              {heading}
            </span>
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-[1.65] text-[#3f3a33]">{lead}</p>
          {videoTitle && (
            <p className="mt-2 max-w-md truncate text-[12px] italic text-[#6b665d]">
              {isPl ? 'Wspierasz przy: ' : 'Supporting from: '}&bdquo;{videoTitle}&rdquo;
            </p>
          )}
        </div>

        {/* amount card */}
        <div className="relative w-fit min-w-[220px] px-7 py-4">
          <Frame radius={14} seed={21} stroke={INK} strokeWidth={1.4} fill="rgba(248,243,231,.94)" showShadow />
          <div className="relative z-10 flex items-baseline gap-2">
            <span
              className="text-[44px] font-bold leading-none tabular-nums"
              style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
            >
              {amount === '' ? '—' : amount}
            </span>
            <span className="text-[18px] font-bold text-[#6b665d]">{selectedCurrency}</span>
          </div>
          <p className="relative z-10 mt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#6b665d]">
            {isPl ? 'Wpłata jednorazowa' : 'One-time payment'}
          </p>
        </div>

        <ul className="m-0 flex max-w-md flex-col gap-[8px] border-t border-dashed border-[#d8d0bd] pt-[12px] text-[13px]">
          {bullets.map((bullet) => (
            <li
              key={bullet.text}
              className={bullet.soft ? 'flex items-start gap-[8px] italic text-[#6b665d]' : 'flex items-start gap-[8px]'}
            >
              {bullet.soft ? (
                <span className="mt-[3px] shrink-0 text-[10px] text-primary">◆</span>
              ) : (
                <span className="mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#171717] text-[9px] font-bold text-[#f8f3e7]">✓</span>
              )}
              {bullet.text}
            </li>
          ))}
        </ul>
      </div>

      {/* footer */}
      <div className="relative z-10 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#6b665d]">
        <span>{MAIN_CREATOR_NAME} &copy; {new Date().getFullYear()}</span>
        <span>{isPl ? 'Bezpieczna płatność · Stripe' : 'Secure payment · Stripe'}</span>
      </div>
    </div>
  );
}
