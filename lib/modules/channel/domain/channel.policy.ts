import { VideoStatus, type ChannelStatus, type Prisma } from '@prisma/client';
import { MainChannelError } from '../domain/channel.errors';

/**
 * Prisma filter equal to `MainChannelPolicy.isPubliclyVisible` for a `creator` relation or a `Creator` query
 * (CLAUDE.md 4.24): ACTIVE or LIMITED and not deleted. The one replacement for the old `isApproved`/`isPrimary` filters.
 */
export function publiclyVisibleChannelWhere(): Prisma.CreatorWhereInput {
  return { status: { in: ['ACTIVE', 'LIMITED'] as ChannelStatus[] }, deletedAt: null };
}

export class MainChannelPolicy {
  /**
   * A channel's videos may be shown publicly (CLAUDE.md 4.24): the channel is ACTIVE or LIMITED and was not deleted.
   * `status` is the only source (the legacy `isApproved` flag is no longer read). Fails closed on a missing status.
   * Works for every channel, not only the main one.
   */
  static isPubliclyVisible(channel: { status?: string | null; deletedAt?: Date | null }): boolean {
    if (channel.deletedAt) return false;
    return channel.status === 'ACTIVE' || channel.status === 'LIMITED';
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
      throw new MainChannelError(`Video does not belong to the main channel (expected ${channelId}, got ${video.creatorId})`, 403, 'FORBIDDEN_VIDEO_ACCESS');
    }
  }
}
