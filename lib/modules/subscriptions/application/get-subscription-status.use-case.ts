import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService, ChannelRepository } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";

export interface SubscriptionStatusDto {
  isSubscribed: boolean;
  subscribedAt: Date | null;
  subscribersCount: number;
  creatorId: string;
  creatorSlug: string;
  purpose: "EMAIL_NOTIFICATIONS";
}

export class GetSubscriptionStatusUseCase {
  static async execute(ctx: AppContext): Promise<SubscriptionStatusDto> {
    const mainChannel = await MainChannelService.getRequired(ctx);
    const subscriptionRepo = new SubscriptionRepository(ctx.db.read);
    const channelRepo = new ChannelRepository(ctx.db.read);

    const userId = (ctx.actor as any).userId;
    if (!userId) {
       throw new Error("UserId is required for subscription status");
    }

    const [subscription, creator] = await Promise.all([
      subscriptionRepo.findByUserIdAndCreatorId(userId, mainChannel.id),
      channelRepo.findById(mainChannel.id),
    ]);

    return {
      isSubscribed: !!subscription,
      subscribedAt: subscription?.createdAt ?? null,
      subscribersCount: creator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
    };
  }
}
