import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";
import { isAdultVideo } from "@/lib/modules/video/domain/video-visibility";
import { isUpcomingPremiere } from "@/lib/premiere";
import type { PlaylistVisibilityValue } from "./playlist-rules";

/**
 * Who sees what (docs/architecture/playlists.md):
 *  - PUBLIC:   on the channel's list of playlists and reachable by link.
 *  - UNLISTED: reachable by link only (never listed, `noindex`).
 *  - PRIVATE:  never served publicly (404 for everybody); the channel's members work with it in the Studio.
 * Items are filtered per viewer by `isPlaylistItemVisible`: the same rule as a public channel list.
 */

type PlaylistFacts = { visibility: string; deletedAt?: Date | null };
type ChannelFacts = { status?: string | null; deletedAt?: Date | null };

/** Whether the public may open the playlist page / queue at all (by link). */
export function isPlaylistServedPublicly(playlist: PlaylistFacts, channel: ChannelFacts): boolean {
  if (playlist.deletedAt) return false;
  if (playlist.visibility !== "PUBLIC" && playlist.visibility !== "UNLISTED") return false;
  return MainChannelPolicy.isPubliclyVisible(channel);
}

/** Whether the playlist is shown on the channel's public list of playlists. */
export function isPlaylistListed(playlist: PlaylistFacts, channel: ChannelFacts): boolean {
  return playlist.visibility === "PUBLIC" && isPlaylistServedPublicly(playlist, channel);
}

/** Search engines may index only a PUBLIC playlist. */
export function shouldNoIndexPlaylist(visibility: PlaylistVisibilityValue | string): boolean {
  return visibility !== "PUBLIC";
}

export type PlaylistItemVideoFacts = {
  creatorId: string;
  status?: string | null;
  moderationStatus?: string | null;
  isAdult?: boolean | null;
  publishedAt?: Date | string | null;
  premiereAt?: Date | string | null;
};

/**
 * A playlist item the viewer may see in a public playlist: a PUBLISHED, due video of the playlist's own channel,
 * not removed by moderation, not an upcoming premiere, and 18+ only for a signed-in viewer. Hidden, draft, unlisted,
 * archived and foreign videos are skipped without a trace (no placeholder, no count).
 */
export function isPlaylistItemVisible(
  video: PlaylistItemVideoFacts,
  context: { channelId: string; signedIn: boolean; now: Date },
): boolean {
  if (video.creatorId !== context.channelId) return false;
  if (video.status !== "PUBLISHED") return false;
  if (video.moderationStatus === "REMOVED") return false;
  if (isAdultVideo(video) && !context.signedIn) return false;
  if (video.publishedAt) {
    const at = video.publishedAt instanceof Date ? video.publishedAt : new Date(video.publishedAt);
    if (at.getTime() > context.now.getTime()) return false;
  }
  if (isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt }, context.now)) return false;
  return true;
}
