"use client";

import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
}

// KUTASHI.COM wordmark, set in the site's brand logo font (Space Grotesk
// Bold, --font-brand-logo) with the ".COM" suffix picked out in the
// --chan-amber accent, matching the site's blue/amber accent pairing.
// Replaces the earlier glasses graphic (public/logo-glasses.svg).
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "KUTASHI.COM"}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        "inline-flex select-none items-center whitespace-nowrap font-brandLogo leading-none tracking-tight text-[var(--chan-ink)]",
        className,
      )}
    >
      KUTASHI
      <span className="text-[var(--chan-amber)]">.COM</span>
    </span>
  );
}
