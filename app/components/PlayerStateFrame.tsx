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
          ? "h-full min-h-0 rounded-lg border border-neutral-800/50"
          : "aspect-video min-h-0 sm:min-h-[220px] rounded-xl shadow-2xl border border-neutral-800/50",
        className
      )}
    >
      {children}
    </div>
  );
}
