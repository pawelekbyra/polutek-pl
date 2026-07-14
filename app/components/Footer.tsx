'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import { getLocalizedHref } from '@/lib/i18n/routing';
import { Footer as FlowbiteFooter, FooterCopyright, FooterLinkGroup, FooterLink } from 'flowbite-react';

const Footer = () => {
  const { language } = useLanguage();
  const isPl = language === 'pl';

  return (
    <FlowbiteFooter container className="rounded-none border-t border-[var(--chan-line)] bg-[var(--chan-nav)] py-5">
      <div className="max-w-[1240px] mx-auto flex w-full flex-col items-center justify-center gap-[10px] px-[22px] md:flex-row md:justify-between md:gap-[14px]">
        <div className="hidden w-32 md:block" />

        <FooterCopyright
          href={getLocalizedHref(language, "home")}
          by="WWW.POLUTEK.PL"
          year={new Date().getFullYear()}
          className="order-2 font-brand text-center text-[12px] font-bold tracking-[0.1em] uppercase text-[var(--chan-muted-2)] md:order-none [&_span]:text-inherit"
        />

        <FooterLinkGroup className="order-1 flex justify-center gap-[22px] text-center font-sans text-[12.5px] font-medium text-[var(--chan-muted)] md:order-none">
          <FooterLink as={Link} href={getLocalizedHref(language, "terms")} className="hover:text-[var(--chan-ink)] transition-colors">
            {isPl ? "Regulamin" : "Terms"}
          </FooterLink>
          <FooterLink as={Link} href={getLocalizedHref(language, "privacy")} className="hover:text-[var(--chan-ink)] transition-colors">
            {isPl ? "Polityka prywatności" : "Privacy Policy"}
          </FooterLink>
        </FooterLinkGroup>
      </div>
    </FlowbiteFooter>
  );
};

export default Footer;
