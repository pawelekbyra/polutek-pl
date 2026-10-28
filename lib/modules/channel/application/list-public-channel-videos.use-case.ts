import { CHANNEL_VIDEOS_PAGE_SIZE, CreatorContentService } from "../infrastructure/creator-content.service";
import type { PublicVideoDTO } from "@/app/types/video";

export type PublicChannelVideosPage = {
  videos: PublicVideoDTO[];
  /** All public videos of the channel. */
  total: number;
  hasMore: boolean;
};

/**
 * One page of a publicly visible channel's videos, in the channel page's order (W04), or null when the channel is
 * not publicly visible (hidden, suspended, deleted and unknown look the same). Public read.
 */
export async function listPublicChannelVideos(channelId: string, offset: number): Promise<PublicChannelVideosPage | null> {
  const channel = await CreatorContentService.getCreatorHeaderById(channelId);
  if (!channel) return null;
  const videos = await CreatorContentService.getChannelVideosPage(channel, { offset, limit: CHANNEL_VIDEOS_PAGE_SIZE });
  return { videos, total: channel.videoCount, hasMore: offset + videos.length < channel.videoCount };
}
