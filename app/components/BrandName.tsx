"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
  shine?: false | "hover" | "ambient";
}

/**
 * Logo marki — okularki wektorowe z /public/logo-glasses.svg.
 */
export default function BrandName({
  className,
  decorative = false,
}: BrandNameProps) {
  return (
    <span
      className={cn("inline-flex select-none items-center", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK.PL"}
      aria-hidden={decorative ? true : undefined}
    >
      <Image
        src="/logo-glasses.svg"
        alt={decorative ? "" : "POLUTEK.PL"}
        width={110}
        height={28}
        priority
        className="h-[28px] w-auto md:h-[34px]"
        aria-hidden={decorative ? true : undefined}
      />
    </span>
  );
}
