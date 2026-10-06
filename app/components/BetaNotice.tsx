"use client";

import { useLanguage } from "@/app/components/LanguageContext";
import { SITE_IS_BETA } from "@/lib/site-stage";

/**
 * Discreet "test version" strip at the top of the sticky header (Navbar). It is server-rendered with
 * the page and has a fixed height, so it never shifts the layout, and it sits inside the page: the
 * entry gate (which covers and inerts the page) is shown before it. Colors are fixed (the site is
 * light only): #5c3d00 on #fff4d6 is about 9:1 contrast. Not dismissible on purpose: a dismissed
 * strip would change the header height after load (layout shift).
 */
export function BetaNotice({ beta = SITE_IS_BETA }: { beta?: boolean }) {
  const { tx } = useLanguage();
  if (!beta) return null;
  return (
    <div
      role="note"
      data-testid="beta-notice"
      className="flex h-6 w-full items-center justify-center border-b border-[#e8d5a0] bg-[#fff4d6] px-3 font-sans text-[11.5px] font-medium leading-none text-[#5c3d00]"
    >
      <span className="truncate">{tx("Strona w budowie (wersja testowa)", "Under construction (test version)")}</span>
    </div>
  );
}
