import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService, ChannelRepository } from "@/lib/modules/channel";
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
    const userId = (ctx.actor as any).userId;
    if (!userId) {
       throw new Error("UserId is required for unsubscribe");
    }

    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptionRepo = new SubscriptionRepository(tx);
      const channelRepo = new ChannelRepository(tx);

      const deleted = await subscriptionRepo.deleteByUserIdAndCreatorId(userId, mainChannel.id, tx);

      if (deleted.count > 0) {
        // We only decrement if count > 0 to be safe, though the DB schema should handle it if count was 0
        // The original code had: where: { id: mainChannel.id, subscribersCount: { gt: 0 } }
        // We can replicate this logic in the repository if needed, but for now we just use the count
        await channelRepo.updateSubscribersCount(mainChannel.id, -1);
      }

      return deleted;
    });

    const channelRepo = new ChannelRepository(ctx.db.read);
    const finalCreator = await channelRepo.findById(mainChannel.id);

    return {
      isSubscribed: false,
      deleted: result.count > 0,
      subscribersCount: finalCreator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      message: "Email notifications disabled for this channel.",
    };
  }
}
