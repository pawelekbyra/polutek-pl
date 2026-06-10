import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";

export interface UnsubscribeResultDto {
  isSubscribed: boolean;
  deleted: boolean;
  subscribersCount: number;
  creatorId: string;
  creatorSlug: string;
  purpose: "EMAIL_NOTIFICATIONS";
  message: string;
}

export class UnsubscribeUseCase {
  static async execute(ctx: AppContext): Promise<UnsubscribeResultDto> {
    const mainChannel = await MainChannelService.getRequired(ctx);
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
       throw new Error("UserId is required for unsubscribe");
    }

    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptionRepo = new SubscriptionRepository(tx);

      const deleted = await subscriptionRepo.deleteByUserIdAndCreatorId(userId, mainChannel.id, tx);

      if (deleted.count > 0) {
        await MainChannelService.decrementSubscribersCount(ctx, mainChannel.id, tx);
      }

      return deleted;
    });

    const finalChannel = await MainChannelService.getRequired(ctx);

    return {
      isSubscribed: false,
      deleted: result.count > 0,
      subscribersCount: finalChannel.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      message: "Email notifications disabled for this channel.",
    };
  }
}
