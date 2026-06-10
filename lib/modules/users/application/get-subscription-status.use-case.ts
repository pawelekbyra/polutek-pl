import { AppContext } from "@/lib/modules/shared/app-context";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { MainChannelService, ChannelRepository } from "@/lib/modules/channel";

export interface SubscriptionStatusDto {
  isSubscribed: boolean;
  subscribedAt: Date | null;
  subscribersCount: number;
  creatorId: string;
  creatorSlug: string;
  purpose: 'EMAIL_NOTIFICATIONS';
}

export class GetSubscriptionStatusUseCase {
  static async execute(ctx: AppContext, userId: string): Promise<SubscriptionStatusDto> {
    const mainChannel = await MainChannelService.getRequired(ctx);

    const subscriptionRepo = new SubscriptionRepository(ctx.prisma);
    const channelRepo = new ChannelRepository(ctx.prisma);

    const [subscription, creator] = await Promise.all([
      subscriptionRepo.findSubscription(userId, mainChannel.id),
      channelRepo.findById(mainChannel.id)
    ]);

    return {
      isSubscribed: !!subscription,
      subscribedAt: subscription?.createdAt ?? null,
      subscribersCount: creator?.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: 'EMAIL_NOTIFICATIONS',
    };
  }
}
