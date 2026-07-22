"use client";

import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
  shine?: false | "hover" | "ambient";
}

// POLUTEK.PL wordmark: "POLUTEK" in --chan-ink, ".PL" in --chan-blue.
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center font-brandLogo font-bold tracking-[0.01em]",
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
