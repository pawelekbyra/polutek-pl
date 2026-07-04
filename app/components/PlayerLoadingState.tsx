"use client";

import React from "react";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { cn } from "@/lib/utils";

interface PlayerLoadingStateProps {
  className?: string;
  fill?: boolean;
  variant?: "default" | "thumbnail" | "thumbnailCompact";
}

/**
 * Unified loading state for the video player area.
 * Uses a stable poster-like frame rather than a skeleton so app-level
 * preloading can keep video switches feeling immediate.
 */
export function PlayerLoadingState({
  className,
  fill = false,
  variant = "default",
}: PlayerLoadingStateProps) {
  const isThumbnail = variant === "thumbnail" || variant === "thumbnailCompact";

  return (
    <PlayerStateFrame
      className={cn(className, isThumbnail ? "rounded-lg" : undefined)}
      fill={fill || variant === "thumbnailCompact"}
    >
      <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-4 bg-black text-white">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-white/70" />
        </div>
        {!isThumbnail && (
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/55">
            Przygotowuję film
          </p>
        )}
      </div>
    </PlayerStateFrame>
  );
}
