"use client";

import { createContext, useContext } from "react";
import type { PlaybackPlan } from "@/lib/modules/playback";
import type { AccessTierDto } from "@/lib/modules/comments/domain/comment-frontend.dto";

export interface VideoAccessContextValue {
  hasAccess: boolean;
  playbackPlan: PlaybackPlan | null;
  isLoading: boolean;
  effectiveTier: AccessTierDto;
  refreshPlaybackPlan: () => Promise<void>;
}

export const VideoAccessContext = createContext<VideoAccessContextValue>({
  hasAccess: false,
  playbackPlan: null,
  isLoading: true,
  effectiveTier: "PUBLIC",
  refreshPlaybackPlan: async () => {},
});

export function useVideoAccess() {
  return useContext(VideoAccessContext);
}
