"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PlayerStateFrameProps {
  children: React.ReactNode;
  className?: string;
  fill?: boolean;
}

/**
 * A stable container for player states (Loading, Error, Paywall)
 * ensures 16:9 aspect ratio and consistent styling.
 */
export function PlayerStateFrame({ children, className, fill = false }: PlayerStateFrameProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-black",
        fill
          ? "h-full min-h-0 rounded-xl border border-black/10"
          : "aspect-video min-h-0 sm:min-h-[220px] rounded-[18px] border border-black/10 shadow-[0_18px_48px_rgba(15,23,42,0.16)]",
        className
      )}
    >
      {children}
    </div>
  );
}
