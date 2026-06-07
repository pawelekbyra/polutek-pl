"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PlayerStateFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A stable container for player states (Loading, Error, Paywall)
 * ensures 16:9 aspect ratio and consistent styling.
 */
export function PlayerStateFrame({ children, className }: PlayerStateFrameProps) {
  return (
    <div
      className={cn(
        "relative w-full aspect-video min-h-0 sm:min-h-[220px] overflow-hidden rounded-xl bg-black shadow-2xl border border-neutral-800/50",
        className
      )}
    >
      {children}
    </div>
  );
}
