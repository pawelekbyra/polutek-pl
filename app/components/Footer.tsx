'use client';

import React from 'react';
import Link from 'next/link';
import BrandName from './BrandName';
import { useLanguage } from './LanguageContext';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  return (
    <footer className="border-t border-border bg-secondary mt-12">
      <div className="max-w-[1180px] mx-auto flex flex-wrap items-center justify-between gap-[14px] p-[22px]">
        <BrandName className="text-[15px] tracking-[-0.02em]" />

        <div className="flex gap-[22px] text-[12.5px] text-muted-foreground font-medium">
          <Link href="/regulamin" className="hover:text-foreground transition-colors">
            {isPl ? "Regulamin" : "Terms"}
          </Link>
          <Link href="/polityka-prywatnosci" className="hover:text-foreground transition-colors">
            {isPl ? "Prywatność" : "Privacy"}
          </Link>
          <a href="mailto:pawel.perfect@gmail.com" className="hover:text-foreground transition-colors">
            {isPl ? "Kontakt" : "Contact"}
          </a>
        </div>

        <span className="text-[12px] text-[#9a958b]">
          Polutek.pl nie jest platformą. Polutek.pl jest miejscem.
        </span>
      </div>
    </footer>
  );
};

export default Footer;
