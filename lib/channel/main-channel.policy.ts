import { AccessTier, Video, VideoStatus } from '@prisma/client';

export class MainChannelPolicy {
  static isPublicMainChannel(channel: { isApproved: boolean; isPrimary: boolean }): boolean {
    return channel.isApproved && channel.isPrimary;
  }

  static isVideoOnMainChannel(video: { creatorId: string }, channelId: string): boolean {
    return video.creatorId === channelId;
  }

  static buildMainChannelVideoWhere(channelId: string) {
    return {
      creatorId: channelId,
    };
  }

  static buildPublicMainChannelVideoWhere(channelId: string, now: Date = new Date()) {
    return {
      creatorId: channelId,
      status: VideoStatus.PUBLISHED,
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: now } },
      ],
    };
  }

  static assertVideoBelongsToMainChannel(video: { creatorId: string }, channelId: string) {
    if (video.creatorId !== channelId) {
      throw new Error(`Video does not belong to the main channel (expected ${channelId}, got ${video.creatorId})`);
    }
  }
}
