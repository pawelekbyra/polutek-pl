import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { MainChannelService } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { EmailPreferenceRepository } from "../infrastructure/email-preference.repository";
import { ResendAudienceGateway } from "../infrastructure/resend-audience.gateway";
import { normalizeTrustedEmail } from "../domain/email-address";
import { ProviderSyncStatus } from "../domain/provider-sync-status";
import { SubscriptionStatusDto } from "./get-subscription-status.use-case";
import { resolveSubscribableChannel } from "./resolve-subscription-channel";

export type SubscribeInput = {
  trustedEmail: string;
  /** Channel id to subscribe to (must be publicly visible); omitted = the main channel. */
  creatorId?: string | null;
  audienceGateway?: Pick<ResendAudienceGateway, 'syncExplicitSubscribe'>;
};

export class SubscribeUseCase {
  static async execute(ctx: AppContext, input: SubscribeInput): Promise<SubscriptionStatusDto & { message: string; providerSyncStatus: ProviderSyncStatus }> {
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
       throw new Error("UserId is required for subscribe");
    }

    const trustedEmail = normalizeTrustedEmail(input.trustedEmail);
    if (!trustedEmail) {
      throw new Error("Trusted user email is required for subscribe");
    }

    const channel = await resolveSubscribableChannel(ctx, input.creatorId);

    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptionRepo = new SubscriptionRepository(tx);
      const preferenceRepo = new EmailPreferenceRepository(tx);

      await subscriptionRepo.lockUser(userId, tx);

      const prefResult = await preferenceRepo.recordExplicitContentOptIn(userId, trustedEmail, tx);

      if (!prefResult.recorded) {
        throw new AppError(
          "Email notification preferences could not be updated for this account.",
          409,
          "EMAIL_PREFERENCE_IDENTITY_CONFLICT"
        );
      }

      // Idempotent: a second subscribe finds the row (unique userId+creatorId) and changes nothing.
      const created = await subscriptionRepo.createIfMissing(userId, channel.id, tx);
      // The counter is always recounted from the rows of this channel, so it cannot drift.
      const synced = await MainChannelService.syncSubscribersCount(ctx, channel.id, tx);

      return { ...created, subscribersCount: synced.subscribersCount ?? 0 };
    });

    const providerSyncStatus = await (input.audienceGateway ?? new ResendAudienceGateway()).syncExplicitSubscribe(trustedEmail);

    return {
      isSubscribed: true,
      subscribedAt: result.subscription.createdAt,
      subscribersCount: result.subscribersCount,
      creatorId: channel.id,
      creatorSlug: channel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      notify: result.subscription.notify ?? true,
      providerSyncStatus,
      message: "Email notifications enabled for this channel.",
    };
  }
}
