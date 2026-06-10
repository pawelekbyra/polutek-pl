import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { SubscriptionStatusDto } from "./get-subscription-status.use-case";

export class SubscribeUseCase {
  static async execute(ctx: AppContext): Promise<SubscriptionStatusDto & { message: string }> {
    const mainChannel = await MainChannelService.getRequired(ctx);
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
       throw new Error("UserId is required for subscribe");
    }

    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptionRepo = new SubscriptionRepository(tx);

      const existing = await subscriptionRepo.findByUserIdAndCreatorId(userId, mainChannel.id);

      if (existing) {
        return { subscription: existing, newlyCreated: false };
      }

      const created = await subscriptionRepo.create(userId, mainChannel.id, tx);
      await MainChannelService.incrementSubscribersCount(ctx, mainChannel.id, tx);

      return { subscription: created, newlyCreated: true };
    });

    const finalChannel = await MainChannelService.getRequired(ctx);

    return {
      isSubscribed: true,
      subscribedAt: result.subscription.createdAt,
      subscribersCount: finalChannel.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      message: "Email notifications enabled for this channel.",
    };
  }
}
