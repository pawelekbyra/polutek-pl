'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import { getLocalizedHref } from '@/lib/i18n/routing';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  const linkClass =
    "relative whitespace-nowrap font-sans text-[12.5px] font-medium text-[var(--chan-muted)] transition-colors duration-200 hover:text-[var(--chan-ink)] after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-[var(--chan-blue)] after:transition-transform after:duration-200 hover:after:scale-x-100";

  return (
    <footer className="relative bg-[var(--chan-nav)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--chan-line)_92%,transparent)_18%,color-mix(in_srgb,var(--chan-line)_92%,transparent)_82%,transparent)]"
      />
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-center gap-[14px] px-6 py-[26px] md:flex-row md:justify-between md:gap-[14px]">
        <div className="hidden w-60 shrink-0 md:block" />

        <span className="font-brand order-2 flex items-center gap-2 text-center text-[12px] font-bold uppercase tracking-[0.22em] text-[var(--chan-muted-2)] md:order-none">
          <span aria-hidden="true" className="inline-flex h-1 w-1 rounded-full bg-[var(--chan-blue)]" />
          WWW.POLUTEK.PL
          <span aria-hidden="true" className="inline-flex h-1 w-1 rounded-full bg-[var(--chan-blue)]" />
        </span>

        <div className="order-1 flex w-60 shrink-0 justify-center gap-[26px] text-center md:order-none md:justify-end">
          <Link href={getLocalizedHref(language, "terms")} className={linkClass}>
            {isPl ? "Regulamin" : "Terms"}
          </Link>
          <Link href={getLocalizedHref(language, "privacy")} className={linkClass}>
            {isPl ? "Polityka prywatności" : "Privacy Policy"}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
