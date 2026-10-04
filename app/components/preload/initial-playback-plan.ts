import type { PlaybackPlan } from "@/lib/modules/playback";

/**
 * A playback plan the server made for this viewer while rendering the page (the hero video), so
 * the browser can mount the player without asking `/api/media-source` first. Bound to the viewer it
 * was made for: the browser uses it only when its own viewer key is the same.
 */
export type InitialPlaybackPlan = {
  videoId: string;
  viewerKey: string;
  plan: PlaybackPlan;
};
