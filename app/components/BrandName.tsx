"use client";

import { cn } from "@/lib/utils";
import { BRAND_LOGO_VARIANT, type BrandLogoVariant } from "@/lib/ui-flags";
import PolutekWordmark from "./brand/PolutekWordmark";
import PolutekWordmarkBlue from "./brand/PolutekWordmarkBlue";
import PolutekWordmarkBlueSymbol from "./brand/PolutekWordmarkBlueSymbol";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
  /** Test/preview override; the site itself always uses BRAND_LOGO_VARIANT (lib/ui-flags.ts). */
  variant?: BrandLogoVariant;
}

// The top-bar logo. One switch (BRAND_LOGO_VARIANT in lib/ui-flags.ts; `npm run logo -- <variant>`) chooses between the blue
// wordmark with the orange play symbol in front ("wordmark-blue-symbol", live since 2026-11-02; "-orbit" = with the two
// orbit arcs), the blue POLUTEK wordmark
// ("wordmark-blue", the owner's image redrawn as SVG), the older POLUTEK lockup with the play badge ("wordmark") and the
// original glasses graphic (public/logo-glasses.svg). All stay in the code, so going back is a one-line change.
export default function BrandName({
  className,
  decorative = false,
  variant = BRAND_LOGO_VARIANT,
}: BrandNameProps) {
  if (variant === "wordmark-blue-symbol-orbit") {
    return <PolutekWordmarkBlueSymbol orbit decorative={decorative} className={className} />;
  }
  if (variant === "wordmark-blue-symbol") {
    return <PolutekWordmarkBlueSymbol decorative={decorative} className={className} />;
  }
  if (variant === "wordmark-blue") {
    return <PolutekWordmarkBlue decorative={decorative} className={className} />;
  }
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
