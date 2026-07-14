"use client";

import type { CSSProperties } from "react";
import { Egg } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogoBrand } from "./logo-experiment/LogoBrandContext";

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
 * Wordmark logo: "POLUTEK.PL" set in Bowlby One SC (self-hosted, `font-brandLogo`).
 * "POLUTEK" is the near-black ink token; the ".PL" (dot + PL) is the site's blue
 * accent.
 *
 * On the temporary /logoN bake-off pages a LogoBrandProvider swaps the font and
 * can prepend a lucide Egg icon; in the production app there is no provider and
 * the default Bowlby wordmark renders.
 */
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
  const logoBrand = useLogoBrand();
  const style = logoBrand?.fontFamily
    ? ({ "--font-brand-logo": logoBrand.fontFamily } as CSSProperties)
    : undefined;

  return (
    <span
      className={cn(
        "font-brandLogo inline-flex select-none items-baseline whitespace-nowrap leading-none tracking-[0.005em]",
        className,
      )}
      style={style}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK.PL"}
      aria-hidden={decorative ? true : undefined}
    >
      {logoBrand?.showEgg && (
        <Egg
          aria-hidden="true"
          className="mr-[0.18em] self-center text-[var(--chan-blue)]"
          style={{ width: "0.92em", height: "0.92em" }}
          strokeWidth={2.4}
        />
      )}
      <span className="text-[var(--chan-ink)]">POLUTEK</span>
      <span className="text-[var(--chan-blue)]">.PL</span>
    </span>
  );
}
