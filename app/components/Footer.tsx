'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  return (
    <footer className="border-t border-border bg-secondary mt-12">
      <div className="max-w-[1180px] mx-auto flex flex-wrap items-center justify-between gap-[14px] p-[22px]">
        <div className="w-32" />

        <span className="text-[13px] font-black tracking-[0.12em] uppercase text-[#3a3a3a]">
          WWW.POLUTEK.PL
        </span>

        <div className="flex gap-[22px] text-[12.5px] text-muted-foreground font-medium">
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
