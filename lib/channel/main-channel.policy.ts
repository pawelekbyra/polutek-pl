import { MainChannelPolicy as NewPolicy } from "../modules/channel/domain/channel.policy";

/** @deprecated Use @/lib/modules/channel/domain/channel.policy */
export class MainChannelPolicy {
  static isPublicMainChannel(channel: { isApproved: boolean; isPrimary: boolean }): boolean {
    return NewPolicy.isPublicMainChannel(channel);
  }

  static isVideoOnMainChannel(video: { creatorId: string }, channelId: string): boolean {
    return NewPolicy.isVideoOnMainChannel(video, channelId);
  }

  static buildMainChannelVideoWhere(channelId: string) {
    return NewPolicy.buildMainChannelVideoWhere(channelId);
  }

  static buildPublicMainChannelVideoWhere(channelId: string, now: Date = new Date()) {
    return NewPolicy.buildPublicMainChannelVideoWhere(channelId, now);
  }

  static assertVideoBelongsToMainChannel(video: { creatorId: string }, channelId: string) {
    return NewPolicy.assertVideoBelongsToMainChannel(video, channelId);
  }
}
