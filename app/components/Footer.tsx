'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import { getLocalizedHref } from '@/lib/i18n/routing';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  return (
    <footer className="mt-12 border-t border-[var(--chan-line)] bg-[var(--chan-nav)]">
      <div className="max-w-[1180px] mx-auto flex flex-col items-center justify-center gap-[10px] p-[22px] md:flex-row md:justify-between md:gap-[14px]">
        <div className="hidden w-32 md:block" />

        <span className="font-brand order-2 text-center text-[12px] font-bold tracking-[0.1em] uppercase text-[var(--chan-muted-2)] md:order-none">
          WWW.POLUTEK.PL
        </span>

        <div className="order-1 flex justify-center gap-[22px] text-center font-sans text-[12.5px] text-[var(--chan-muted)] font-medium md:order-none">
          <Link href={getLocalizedHref(language, "terms")} className="hover:text-[var(--chan-ink)] transition-colors">
            {isPl ? "Regulamin" : "Terms"}
          </Link>
          <Link href={getLocalizedHref(language, "privacy")} className="hover:text-[var(--chan-ink)] transition-colors">
            {isPl ? "Polityka prywatności" : "Privacy Policy"}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
