import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { resolveLeavableChannel } from "./resolve-subscription-channel";

export interface SetSubscriptionNotifyResultDto {
  creatorId: string;
  creatorSlug: string;
  isSubscribed: true;
  notify: boolean;
}

export type SetSubscriptionNotifyInput = {
  /** Omitted = the main channel. */
  creatorId?: string | null;
  notify: boolean;
};

/** The bell: switches notifications of one existing subscription. It never creates or removes a subscription. */
export class SetSubscriptionNotifyUseCase {
  static async execute(ctx: AppContext, input: SetSubscriptionNotifyInput): Promise<SetSubscriptionNotifyResultDto> {
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
      throw new AppError("Sign in to manage notifications.", 401, "UNAUTHORIZED");
    }

    const channel = await resolveLeavableChannel(ctx, input.creatorId);
    const repo = new SubscriptionRepository(ctx.prisma);
    const updated = await repo.setNotify(userId, channel.id, input.notify);

    if (updated.count === 0) {
      throw new AppError("You are not subscribed to this channel.", 404, "SUBSCRIPTION_NOT_FOUND");
    }

    return { creatorId: channel.id, creatorSlug: channel.slug, isSubscribed: true, notify: input.notify };
  }
}
