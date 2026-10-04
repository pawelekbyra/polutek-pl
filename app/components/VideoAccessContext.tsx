"use client";

import { createContext, useContext } from "react";
import type { PlaybackPlan } from "@/lib/modules/playback";
import type { AccessTierDto } from "@/lib/modules/comments/domain/comment-frontend.dto";

export interface VideoAccessContextValue {
  hasAccess: boolean;
  playbackPlan: PlaybackPlan | null;
  isLoading: boolean;
  effectiveTier: AccessTierDto;
  /** Full re-check: shows the loading state and remounts the player. */
  refreshPlaybackPlan: () => Promise<void>;
  /**
   * Silent renewal for an open player (fresh delivery token, same playback session): the plan is
   * replaced in place, nothing unmounts. Resolves with the new playable plan, or null when the
   * viewer can no longer play (then the full re-check has already been started).
   */
  renewPlaybackPlan: () => Promise<PlaybackPlan | null>;
}

export const VideoAccessContext = createContext<VideoAccessContextValue>({
  hasAccess: false,
  playbackPlan: null,
  isLoading: true,
  effectiveTier: "PUBLIC",
  refreshPlaybackPlan: async () => {},
  renewPlaybackPlan: async () => null,
});

export function useVideoAccess() {
  return useContext(VideoAccessContext);
}
