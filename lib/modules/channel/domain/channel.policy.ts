import { VideoStatus } from '@prisma/client';
import { MainChannelError } from '../domain/channel.errors';

export class MainChannelPolicy {
  static isPublicMainChannel(channel: { isApproved: boolean; isPrimary: boolean }): boolean {
    return channel.isApproved && channel.isPrimary;
  }

  /**
   * A channel's videos may be shown publicly (CLAUDE.md 4.24): the channel is ACTIVE or LIMITED, was not deleted and
   * is approved (the legacy flag, kept equal to `status === ACTIVE` until the cleanup migration of stage 8).
   * Works for every channel, not only the main one.
   */
  static isPubliclyVisible(channel: { isApproved: boolean; status?: string | null; deletedAt?: Date | null }): boolean {
    if (channel.deletedAt) return false;
    if (channel.status && channel.status !== 'ACTIVE' && channel.status !== 'LIMITED') return false;
    return channel.isApproved;
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
