import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";
import { isLinkAccessibleStatus } from "./video-visibility";

type VisibilityInput = {
  status?: string | null;
  publishedAt?: Date | string | null;
  moderationStatus?: string | null;
  creator?: { status?: string | null; deletedAt?: Date | null } | null;
};

/**
 * Whether a video may be opened by link by the public (the same rules as `checkVideoAccess` without a preview right):
 * PUBLISHED or UNLISTED and already due, not removed by moderation, on a publicly visible channel (CLAUDE.md 4.24).
 * Tier and premiere gating are separate decisions made at playback.
 */
export function isVideoPubliclyVisible(video: VisibilityInput, now: Date = new Date()): boolean {
  // UNLISTED is reachable by link; it is kept off every list by the list queries, not here.
  if (!isLinkAccessibleStatus(video.status)) return false;
  if (video.moderationStatus === "REMOVED") return false;
  if (video.publishedAt) {
    const at = video.publishedAt instanceof Date ? video.publishedAt : new Date(video.publishedAt);
    if (at.getTime() > now.getTime()) return false;
  }
  if (!video.creator) return false;
  return MainChannelPolicy.isPubliclyVisible(video.creator);
}
