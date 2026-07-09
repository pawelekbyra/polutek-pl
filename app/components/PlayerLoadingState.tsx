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
 * Bar + label shown while the player prepares content. Shared between the
 * standalone access-check state below and the bare overlay VideoPlayer keeps
 * on top of the mounted media element until the first real frame renders, so
 * both loading phases read as one continuous indicator instead of two.
 */
export function PlayerLoadingIndicator({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-4 bg-black text-white">
      <div className="relative h-1 w-40 overflow-hidden rounded-full bg-white/15">
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-white/80 animate-player-loading-sweep" />
      </div>
      {!compact && (
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/55">
          Przygotowuję film
        </p>
      )}
    </div>
  );
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
      <PlayerLoadingIndicator compact={isThumbnail} />
    </PlayerStateFrame>
  );
}
