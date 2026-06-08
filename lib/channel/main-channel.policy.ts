/**
 * @deprecated Use @/lib/modules/channel instead.
 */
import { MainChannelPolicy as NewMainChannelPolicy } from '@/lib/modules/channel';

export class MainChannelPolicy {
  static isPublicMainChannel(channel: { isApproved: boolean; isPrimary: boolean }): boolean {
    return NewMainChannelPolicy.isPublicMainChannel(channel);
  }

  static isVideoOnMainChannel(video: { creatorId: string }, channelId: string): boolean {
    return NewMainChannelPolicy.isVideoOnMainChannel(video, channelId);
  }

  static buildMainChannelVideoWhere(channelId: string) {
    return NewMainChannelPolicy.buildMainChannelVideoWhere(channelId);
  }

  static buildPublicMainChannelVideoWhere(channelId: string, now: Date = new Date()) {
    return NewMainChannelPolicy.buildPublicMainChannelVideoWhere(channelId, now);
  }

  static assertVideoBelongsToMainChannel(video: { creatorId: string }, channelId: string) {
    return NewMainChannelPolicy.assertVideoBelongsToMainChannel(video, channelId);
  }
}
