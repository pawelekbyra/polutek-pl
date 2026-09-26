"use client";

import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
}

// KUTASHI.COM text wordmark, Montserrat Black (see app/fonts.ts's
// `brandLogoFont`/--font-brand-logo). Replaces the earlier glasses-graphic
// logo (public/logo-glasses.svg, still present on disk if a future revision
// wants it back) at the owner's explicit request (2026-09-26).
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
  return (
    <span
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      className={cn(
        "inline-flex select-none items-center font-brandLogo leading-none tracking-tight text-[20px] md:text-[24px]",
        className,
      )}
    >
      <span className="text-[var(--chan-ink)]">KUTASHI</span>
      <span className="text-[var(--chan-blue)]">.COM</span>
    </span>
  );
}
