import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { EmailPreferenceRepository } from "../infrastructure/email-preference.repository";
import { normalizeTrustedEmail } from "../domain/email-address";
import { createScopedLogger } from "@/lib/logger";

export interface UnsubscribeResultDto {
  isSubscribed: boolean;
  deleted: boolean;
  subscribersCount: number;
  creatorId: string;
  creatorSlug: string;
  purpose: "EMAIL_NOTIFICATIONS";
  message: string;
}

export type UnsubscribeInput = {
  trustedEmail: string;
};

export class UnsubscribeUseCase {
  static async execute(ctx: AppContext, input: UnsubscribeInput): Promise<UnsubscribeResultDto> {
    const logger = createScopedLogger(ctx.requestId ?? null);
    const mainChannel = await MainChannelService.getRequired(ctx);
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
       throw new Error("UserId is required for unsubscribe");
    }

    const trustedEmail = normalizeTrustedEmail(input.trustedEmail);
    if (!trustedEmail) {
      throw new Error("Trusted user email is required for unsubscribe");
    }

    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptionRepo = new SubscriptionRepository(tx);
      const preferenceRepo = new EmailPreferenceRepository(tx);

      const deleted = await subscriptionRepo.deleteByUserIdAndCreatorId(userId, mainChannel.id, tx);
      const prefResult = await preferenceRepo.recordExplicitContentOptOut(userId, trustedEmail, tx);

      if (!prefResult.recorded && prefResult.reason === 'FOREIGN_EMAIL_CONFLICT') {
        logger.warn(`[SUBSCRIPTION_IDENTITY_CONFLICT] userId=${userId} reason=${prefResult.reason}`);
      }

      const syncedChannel = typeof MainChannelService.syncSubscribersCount === "function"
        ? await MainChannelService.syncSubscribersCount(ctx, mainChannel.id, tx)
        : await (async () => {
            if (deleted.count > 0) {
              await MainChannelService.decrementSubscribersCount(ctx, mainChannel.id, tx);
            }
            return await MainChannelService.getRequired(ctx);
          })();
      return { deletedCount: deleted.count, subscribersCount: syncedChannel.subscribersCount ?? 0 };
    });

    const finalChannel = await MainChannelService.getRequired(ctx);

    return {
      isSubscribed: false,
      deleted: result.deletedCount > 0,
      subscribersCount: result.subscribersCount ?? finalChannel.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      message: "Email notifications disabled for this channel.",
    };
  }
}
