import { AppContext } from "@/lib/modules/shared/app-context";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { MainChannelService, ChannelRepository } from "@/lib/modules/channel";
import { SubscriptionStatusDto } from "./get-subscription-status.use-case";

export class SubscribeUseCase {
  static async execute(ctx: AppContext, userId: string): Promise<SubscriptionStatusDto & { message: string }> {
    const mainChannel = await MainChannelService.getRequired(ctx);

    const subscriptionRepo = new SubscriptionRepository(ctx.prisma);
    const channelRepo = new ChannelRepository(ctx.prisma);

    const subscription = await ctx.prisma.$transaction(async (tx) => {
      const txSubscriptionRepo = new SubscriptionRepository(tx);
      const txChannelRepo = new ChannelRepository(tx);

      const existing = await txSubscriptionRepo.findSubscription(userId, mainChannel.id);
      if (existing) return existing;

      const created = await txSubscriptionRepo.createSubscription(tx, userId, mainChannel.id);
      await txChannelRepo.updateSubscribersCount(mainChannel.id, 1);

      return created;
    });

    const finalCreator = await channelRepo.findById(mainChannel.id);

    return {
      isSubscribed: true,
      subscribedAt: subscription.createdAt,
      subscribersCount: finalCreator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: 'EMAIL_NOTIFICATIONS',
      message: 'Email notifications enabled for this channel.',
    };
  }
}
