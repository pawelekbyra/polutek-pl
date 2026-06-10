import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "@/lib/modules/channel";
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

    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
       throw new Error("UserId is required for subscription status");
    }

    const subscription = await subscriptionRepo.findByUserIdAndCreatorId(userId, mainChannel.id);

    return {
      isSubscribed: !!subscription,
      subscribedAt: subscription?.createdAt ?? null,
      subscribersCount: mainChannel.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
    };
  }
}
