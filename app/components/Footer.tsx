'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import { getLocalizedHref } from '@/lib/i18n/routing';
import LanguageSwitcher from './LanguageSwitcher';
import { useSwitchLanguage } from './useSwitchLanguage';

/** The language list in the footer; useSwitchLanguage reads the URL, so it sits in its own Suspense. */
function FooterLanguage() {
  const { language } = useLanguage();
  const switchLanguage = useSwitchLanguage();
  return (
    <div className="flex items-center">
      <LanguageSwitcher language={language} onSelect={switchLanguage} variant="dropup" />
    </div>
  );
}

const Footer = () => {
  const { language, tx } = useLanguage();

  const linkClass =
    "relative whitespace-nowrap font-sans text-[12.5px] font-medium text-[var(--chan-muted)] transition-colors duration-200 hover:text-[var(--chan-ink)] after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-[var(--chan-blue)] after:transition-transform after:duration-200 hover:after:scale-x-100";

  return (
    <footer className="relative bg-[var(--chan-nav)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--cm-line-92)_18%,var(--cm-line-92)_82%,transparent)]"
      />
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-center gap-[14px] px-6 pb-[26px] pt-[14px] md:flex-row md:py-[26px] md:justify-between md:gap-[14px]">
        {/* Equal flexible side columns keep the brand centred, and the right one grows with long labels (de, fr). */}
        <div className="order-3 flex w-full justify-center md:order-none md:w-auto md:flex-1 md:justify-start">
          <Suspense fallback={null}>
            <FooterLanguage />
          </Suspense>
        </div>

        {/* pl- offsets the trailing letter-spacing, so the name sits exactly on the centre line. */}
        <span className="font-brand order-2 pl-[0.22em] text-center text-[12px] font-bold uppercase leading-none tracking-[0.22em] text-[var(--chan-muted-2)] md:order-none">
          WWW.POLUTEK.COM
        </span>

        <div className="order-1 flex shrink-0 items-center justify-center gap-[26px] text-center leading-none md:order-none md:flex-1 md:justify-end">
          <Link href={getLocalizedHref(language, "terms")} className={linkClass}>
            {tx("Regulamin", "Terms")}
          </Link>
          <Link href={getLocalizedHref(language, "privacy")} className={linkClass}>
            {tx("Polityka prywatności", "Privacy Policy")}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
