"use client";

import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
}

// www.pawelperfect.pl logo mark: the glasses graphic (public/logo-glasses.svg).
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
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
