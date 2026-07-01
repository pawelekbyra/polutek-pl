'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import { YELLOW, INK, BLUE } from './najs/primitives';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  return (
    <footer className="mt-12">
      <div className="h-[3px] w-full" style={{ background: INK }} />
      <div className="max-w-[1180px] mx-auto flex flex-col items-center justify-center gap-[10px] p-[22px] md:flex-row md:justify-between md:gap-[14px]">
        <div className="hidden w-32 md:block" />

        <span className="order-2 flex flex-col items-center gap-[4px] text-center md:order-none">
          <span
            className="inline-flex items-center gap-[8px] text-[13px] font-black tracking-[0.16em] uppercase text-[#171717] px-[14px] py-[6px] rounded-[8px]"
            style={{
              fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)",
              border: `2.5px solid ${INK}`,
              boxShadow: `3px 3px 0 ${INK}`,
              background: YELLOW,
            }}
          >
            WWW.POLUTEK.PL
          </span>
        </span>

        <div className="order-1 flex justify-center gap-[22px] text-center text-[12.5px] font-black uppercase tracking-widest md:order-none" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
          <Link
            href="/regulamin"
            className="hover:underline transition-all"
            style={{ textDecorationColor: BLUE, textDecorationThickness: "2px" }}
          >
            {isPl ? "Regulamin" : "Terms"}
          </Link>
          <Link
            href="/polityka-prywatnosci"
            className="hover:underline transition-all"
            style={{ textDecorationColor: BLUE, textDecorationThickness: "2px" }}
          >
            {isPl ? "Polityka prywatności" : "Privacy Policy"}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
