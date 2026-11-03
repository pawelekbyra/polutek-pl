"use client";

import { cn } from "@/lib/utils";
import { TOPBAR_PREMIERE, type TopbarPremiereConfig } from "@/lib/ui-flags";
import { useLanguage } from "./LanguageContext";
import styles from "./TopbarPremiere.module.css";

/** "2027-01-01" -> "01.01.2027" (plain string work, no time zone); anything else -> null. */
export function formatPremiereDate(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null;
}

/**
 * The hand-written premiere date next to the logo in the top bar (single switch: TOPBAR_PREMIERE in lib/ui-flags.ts, null hides it).
 * Plain text: not a link, not focusable, no pointer events, not aria-hidden. It sits out of the way where the bar is tight:
 * hidden under 360px (the signed-out bar has no room left next to the language pill and the sign-in button) and from md to 1179px (there the search box would lose its 548px).
 */
export default function TopbarPremiere({ premiere = TOPBAR_PREMIERE, className }: { premiere?: TopbarPremiereConfig | null; className?: string }) {
  const { tx } = useLanguage();
  const date = premiere ? formatPremiereDate(premiere.date) : null;
  if (!date) return null;
  return (
    <p
      data-testid="topbar-premiere"
      className={cn(styles.premiere, "ml-2 max-[359px]:hidden md:max-[1179px]:hidden md:ml-3", className)}
    >
      {tx("PREMIERA: {0}.", "PREMIERE: {0}.", date)}
    </p>
  );
}
