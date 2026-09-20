"use client";

import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
}

// TEMPORARY (test setup only) — see CLAUDE.md "2026-09-20: temporary test-mode UI changes"
// for the exact revert steps. Set to `false` (or delete this flag and the branch that reads
// it) to restore the permanent glasses-mark logo (public/logo-glasses.svg) below.
const TEMP_LOGO_AS_TEXT = true;

// www.pawelperfect.pl logo mark: the glasses graphic (public/logo-glasses.svg).
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
  if (TEMP_LOGO_AS_TEXT) {
    return (
      <span
        aria-hidden={decorative ? true : undefined}
        draggable={false}
        className={cn(
          "inline-flex select-none items-center font-heading font-black leading-none tracking-tight text-[20px] md:text-[24px]",
          className,
        )}
      >
        <span className="text-[var(--chan-ink)]">KUTASHI</span>
        <span className="text-[var(--chan-blue)]">.COM</span>
      </span>
    );
  }

  return (
    <img
      src="/logo-glasses.svg"
      alt={decorative ? "" : "www.pawelperfect.pl"}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      className={cn("h-full w-auto select-none", className)}
    />
  );
}
