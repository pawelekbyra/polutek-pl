import { AppContext } from "@/lib/modules/shared/app-context";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { MainChannelService, ChannelRepository } from "@/lib/modules/channel";

export interface UnsubscribeResultDto {
  isSubscribed: boolean;
  deleted: boolean;
  subscribersCount: number;
  creatorId: string;
  creatorSlug: string;
  purpose: 'EMAIL_NOTIFICATIONS';
  message: string;
}

export class UnsubscribeUseCase {
  static async execute(ctx: AppContext, userId: string): Promise<UnsubscribeResultDto> {
    const mainChannel = await MainChannelService.getRequired(ctx);

    const subscriptionRepo = new SubscriptionRepository(ctx.prisma);
    const channelRepo = new ChannelRepository(ctx.prisma);

    const result = await ctx.prisma.$transaction(async (tx) => {
      const txSubscriptionRepo = new SubscriptionRepository(tx);
      const txChannelRepo = new ChannelRepository(tx);

      const deleted = await txSubscriptionRepo.deleteSubscription(tx, userId, mainChannel.id);

      if (deleted.count > 0) {
        await txChannelRepo.updateSubscribersCount(mainChannel.id, -1);
      }

      return deleted;
    });

    const finalCreator = await channelRepo.findById(mainChannel.id);

    return {
      isSubscribed: false,
      deleted: result.count > 0,
      subscribersCount: finalCreator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: 'EMAIL_NOTIFICATIONS',
      message: 'Email notifications disabled for this channel.',
    };
  }
}
