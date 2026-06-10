import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService, ChannelRepository } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { SubscriptionStatusDto } from "./get-subscription-status.use-case";

export class SubscribeUseCase {
  static async execute(ctx: AppContext): Promise<SubscriptionStatusDto & { message: string }> {
    const mainChannel = await MainChannelService.getRequired(ctx);
    const userId = (ctx.actor as any).userId;
    if (!userId) {
       throw new Error("UserId is required for subscribe");
    }

    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptionRepo = new SubscriptionRepository(tx);
      const channelRepo = new ChannelRepository(tx);

      const existing = await subscriptionRepo.findByUserIdAndCreatorId(userId, mainChannel.id);

      if (existing) {
        return { subscription: existing, newlyCreated: false };
      }

      const created = await subscriptionRepo.create(userId, mainChannel.id, tx);
      await channelRepo.updateSubscribersCount(mainChannel.id, 1);

      return { subscription: created, newlyCreated: true };
    });

    const channelRepo = new ChannelRepository(ctx.db.read);
    const finalCreator = await channelRepo.findById(mainChannel.id);

    return {
      isSubscribed: true,
      subscribedAt: result.subscription.createdAt,
      subscribersCount: finalCreator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      message: "Email notifications enabled for this channel.",
    };
  }
}
