'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import { NajsSeparator } from './najs/primitives';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  return (
    <footer className="mt-12">
      <NajsSeparator className="px-4" />
      <div className="max-w-[1180px] mx-auto flex flex-col items-center justify-center gap-[10px] p-[22px] md:flex-row md:justify-between md:gap-[14px]">
        <div className="hidden w-32 md:block" />

        <span className="order-2 text-center text-[13px] font-black tracking-[0.12em] uppercase text-[#3a3a3a] md:order-none" style={{ fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}>
          WWW.POLUTEK.PL
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
