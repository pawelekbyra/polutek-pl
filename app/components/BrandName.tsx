"use client";

import { cn } from "@/lib/utils";
import { BRAND_LOGO_VARIANT, type BrandLogoVariant } from "@/lib/ui-flags";
import PolutekWordmark from "./brand/PolutekWordmark";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
  /** Test/preview override; the site itself always uses BRAND_LOGO_VARIANT (lib/ui-flags.ts). */
  variant?: BrandLogoVariant;
}

// The top-bar logo. One switch (BRAND_LOGO_VARIANT in lib/ui-flags.ts) chooses between the
// POLUTEK.COM wordmark and the original glasses graphic (public/logo-glasses.svg), which stays in
// the code so it can be restored with a one-line change.
export default function BrandName({
  className,
  decorative = false,
  variant = BRAND_LOGO_VARIANT,
}: BrandNameProps) {
  if (variant === "wordmark") {
    return <PolutekWordmark decorative={decorative} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static local vector
    <img
      src="/logo-glasses.svg"
      alt={decorative ? "" : "www.pawelperfect.com"}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      className={cn("h-[28px] w-auto select-none md:h-[34px]", className)}
    />
  );
}
