import { isUpcomingPremiere } from "@/lib/modules/video/domain/premiere";
import { isLinkAccessibleStatus } from "@/lib/modules/video/domain/video-visibility";
import { isResumablePosition, parseDurationText } from "./progress-rules";

/** Most items on the "Continue watching" shelf. */
export const CONTINUE_WATCHING_LIMIT = 6;

/** What the shelf needs from a stored progress row and its video (all plain values). */
export interface ContinueWatchingCandidate {
  positionSeconds: number;
  durationSeconds: number | null;
  updatedAt: Date;
  video: {
    id: string;
    slug: string;
    title: string;
    titleEn: string | null;
    status: string;
    tier: string;
    moderationStatus: string | null;
    publishedAt: Date | null;
    premiereAt: Date | null;
    duration: string | null;
    thumbnailUrl: string;
    thumbnailPublicUrl: string | null;
    creator: { name: string; status: string; deletedAt: Date | null } | null;
  };
}

export interface ContinueWatchingItem {
  videoId: string;
  slug: string;
  title: string;
  titleEn: string | null;
  /** Safe thumbnail `src` (public R2 copy or the thumbnail proxy), never the stored value. */
  thumbnailUrl: string;
  channelName: string | null;
  positionSeconds: number;
  /** Best known length in seconds (the video's own, else the one the player reported), or null. */
  durationSeconds: number | null;
  /** 0..1 watched share, null when the length is unknown. */
  fraction: number | null;
}

/**
 * Whether a saved position may appear on this viewer's shelf. The shelf is the viewer's own list, so
 * a video they opened by link (UNLISTED) is allowed; what is never shown: drafts and archived,
 * removed-by-moderation, a hidden channel, a premiere that has not started, paid videos (the shelf
 * does not check entitlements, opening the video does) and finished or too short positions.
 */
export function isContinueWatchingEligible(candidate: ContinueWatchingCandidate, now: Date): boolean {
  const { video } = candidate;
  if (!isLinkAccessibleStatus(video.status)) return false;
  if (video.moderationStatus === "REMOVED") return false;
  if (video.tier === "PAID") return false;
  if (video.publishedAt && video.publishedAt.getTime() > now.getTime()) return false;
  if (isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt }, now)) return false;
  const channel = video.creator;
  if (!channel || channel.deletedAt || (channel.status !== "ACTIVE" && channel.status !== "LIMITED")) return false;

  const duration = parseDurationText(video.duration) ?? candidate.durationSeconds;
  return isResumablePosition(candidate.positionSeconds, duration);
}

/** Eligible rows, newest first, at most `limit`, one per video (the table key already guarantees it). */
export function pickContinueWatching(
  candidates: readonly ContinueWatchingCandidate[],
  now: Date,
  limit: number = CONTINUE_WATCHING_LIMIT,
): ContinueWatchingCandidate[] {
  return candidates
    .filter((candidate) => isContinueWatchingEligible(candidate, now))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, Math.max(0, limit));
}

export function toContinueWatchingItem(
  candidate: ContinueWatchingCandidate,
  thumbnailUrl: string,
): ContinueWatchingItem {
  const duration = parseDurationText(candidate.video.duration) ?? candidate.durationSeconds;
  const fraction = duration && duration > 0 ? Math.min(1, Math.max(0, candidate.positionSeconds / duration)) : null;
  return {
    videoId: candidate.video.id,
    slug: candidate.video.slug,
    title: candidate.video.title,
    titleEn: candidate.video.titleEn,
    thumbnailUrl,
    channelName: candidate.video.creator?.name ?? null,
    positionSeconds: candidate.positionSeconds,
    durationSeconds: duration ?? null,
    fraction,
  };
}
