'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import { NajsSeparator, YELLOW, INK } from './najs/primitives';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  return (
    <footer className="mt-12">
      <NajsSeparator className="px-4" />
      <div className="max-w-[1180px] mx-auto flex flex-col items-center justify-center gap-[10px] p-[22px] md:flex-row md:justify-between md:gap-[14px]">
        <div className="hidden w-32 md:block" />

        <span className="order-2 flex flex-col items-center gap-0 text-center md:order-none">
          <span className="flex items-center gap-[6px] text-[13px] font-black tracking-[0.12em] uppercase text-[#3a3a3a]" style={{ fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}>
            <span aria-hidden="true" className="inline-block h-[6px] w-[6px] shrink-0" style={{ background: YELLOW, boxShadow: `1px 1px 0 ${INK}`, transform: "rotate(10deg)" }} />
            WWW.POLUTEK.PL
            <span aria-hidden="true" className="inline-block h-[6px] w-[6px] shrink-0" style={{ background: YELLOW, boxShadow: `1px 1px 0 ${INK}`, transform: "rotate(-8deg)" }} />
          </span>
          <svg className="w-[120px] h-[4px] mt-[2px]" viewBox="0 0 120 4" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 3 2.5 Q 60 0.5 117 2.5" fill="none" stroke={YELLOW} strokeWidth="2.2" strokeLinecap="round" opacity="0.7"/>
          </svg>
        </span>

        <div className="order-1 flex justify-center gap-[22px] text-center text-[12.5px] text-muted-foreground font-medium md:order-none">
          <Link href="/regulamin" className="hover:text-foreground transition-colors">
            {isPl ? "Regulamin" : "Terms"}
          </Link>
          <Link href="/polityka-prywatnosci" className="hover:text-foreground transition-colors">
            {isPl ? "Polityka prywatności" : "Privacy Policy"}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
