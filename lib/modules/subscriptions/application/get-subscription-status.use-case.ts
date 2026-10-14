import { AppContext } from "@/lib/modules/shared/app-context";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { resolveSubscribableChannel } from "./resolve-subscription-channel";

export interface SubscriptionStatusDto {
  isSubscribed: boolean;
  subscribedAt: Date | null;
  subscribersCount: number;
  creatorId: string;
  creatorSlug: string;
  purpose: "EMAIL_NOTIFICATIONS";
  /** The bell of this subscription (true when not subscribed: the default a new subscription gets). */
  notify: boolean;
}

export type GetSubscriptionStatusInput = {
  /** Channel id; omitted = the main channel. */
  creatorId?: string | null;
};

export class GetSubscriptionStatusUseCase {
  static async execute(ctx: AppContext, input: GetSubscriptionStatusInput = {}): Promise<SubscriptionStatusDto> {
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
       throw new Error("UserId is required for subscription status");
    }

    const channel = await resolveSubscribableChannel(ctx, input.creatorId);
    const subscriptionRepo = new SubscriptionRepository(ctx.db.read);
    const subscription = await subscriptionRepo.findByUserIdAndCreatorId(userId, channel.id);

    return {
      isSubscribed: !!subscription,
      subscribedAt: subscription?.createdAt ?? null,
      subscribersCount: channel.subscribersCount ?? 0,
      creatorId: channel.id,
      creatorSlug: channel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      notify: subscription?.notify ?? true,
    };
  }
}
