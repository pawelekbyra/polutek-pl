"use client";

import React from "react";
import { PlayerSkeleton } from "@/components/skeletons";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { cn } from "@/lib/utils";

interface PlayerLoadingStateProps {
  className?: string;
  fill?: boolean;
  variant?: "default" | "thumbnail" | "thumbnailCompact";
}

/**
 * Unified loading state for the video player area.
 * Wraps the PlayerSkeleton in a stable PlayerStateFrame.
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
      <PlayerSkeleton />
    </PlayerStateFrame>
  );
}
