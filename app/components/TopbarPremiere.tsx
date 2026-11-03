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

/** The note is configured and its date is valid (the Navbar then gives the search box a fixed width from 1180px). */
export function isTopbarPremiereActive(premiere: TopbarPremiereConfig | null = TOPBAR_PREMIERE): boolean {
  return premiere !== null && formatPremiereDate(premiere.date) !== null;
}

/**
 * The hand-written premiere date in the top bar (single switch: TOPBAR_PREMIERE in lib/ui-flags.ts, null hides it).
 * It fills the flexible zone between the logo and the search box (phones: between the logo and the search icon) and is
 * centred in it, so the spaces on both sides are equal: the zone's end margins (-9px on phones, -8px on desktop) cancel
 * the 9px the search icon sits inside its button and the search box's own mx-2, so the VISIBLE gaps match.
 * Plain text: not a link, not focusable, no pointer events, not aria-hidden. Hidden under 360px (the signed-out bar has
 * no room left next to the language pill and the sign-in button) and from md to 1179px (there the search box would lose its 548px).
 */
export default function TopbarPremiere({ premiere = TOPBAR_PREMIERE, className }: { premiere?: TopbarPremiereConfig | null; className?: string }) {
  const { tx } = useLanguage();
  const date = premiere ? formatPremiereDate(premiere.date) : null;
  if (!date) return null;
  return (
    <div
      data-testid="topbar-premiere-zone"
      className={cn(
        "-mr-[9px] flex min-w-0 flex-1 items-center justify-center max-[360px]:hidden md:-mr-2 md:max-[1180px]:hidden md:min-w-max md:px-3",
        className,
      )}
    >
      <p data-testid="topbar-premiere" className={styles.premiere}>
        {tx("PREMIERA: {0}.", "PREMIERE: {0}.", date)}
      </p>
    </div>
  );
}

/** Empty twin of the zone on the other side of the search box (same flex share), so the search box stays centred between the logo and the icons. */
export function TopbarPremiereSpacer({ premiere = TOPBAR_PREMIERE }: { premiere?: TopbarPremiereConfig | null }) {
  if (!isTopbarPremiereActive(premiere)) return null;
  return <div aria-hidden="true" className="hidden min-w-0 flex-1 min-[1180px]:block" />;
}
