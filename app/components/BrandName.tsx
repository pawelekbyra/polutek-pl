"use client";

import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
  /**
   * Retained for API compatibility with prior SVG logo callers. The wordmark is
   * plain text now, so this is accepted but no longer renders a shine sweep.
   */
  shine?: false | "hover" | "ambient";
}

/**
 * Wordmark logo: "POLUTEK.PL" set in Space Grotesk Bold (self-hosted, `font-brandLogo`).
 * "POLUTEK" is the near-black ink token; the ".PL" (dot + PL) is the site's blue
 * accent.
 */
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
  return (
    <span
      className={cn(
        "font-brandLogo inline-flex select-none items-baseline whitespace-nowrap leading-none tracking-[0.005em]",
        className,
      )}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK.PL"}
      aria-hidden={decorative ? true : undefined}
    >
      <span className="text-[var(--chan-ink)]">POLUTEK</span>
      <span className="text-[var(--chan-blue)]">.PL</span>
    </span>
  );
}
