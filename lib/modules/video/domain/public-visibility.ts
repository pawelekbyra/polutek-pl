import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";

type VisibilityInput = {
  status?: string | null;
  publishedAt?: Date | string | null;
  moderationStatus?: string | null;
  creator?: { isApproved: boolean; status?: string | null; deletedAt?: Date | null } | null;
};

/**
 * Whether a video may be shown to the public at all (the same rules as `checkVideoAccess` without a preview right):
 * PUBLISHED and already due, not removed by moderation, on a publicly visible channel (CLAUDE.md 4.24).
 * Tier and premiere gating are separate decisions made at playback.
 */
export function isVideoPubliclyVisible(video: VisibilityInput, now: Date = new Date()): boolean {
  if (video.status !== "PUBLISHED") return false;
  if (video.moderationStatus === "REMOVED") return false;
  if (video.publishedAt) {
    const at = video.publishedAt instanceof Date ? video.publishedAt : new Date(video.publishedAt);
    if (at.getTime() > now.getTime()) return false;
  }
  if (!video.creator) return false;
  return MainChannelPolicy.isPubliclyVisible(video.creator);
}
