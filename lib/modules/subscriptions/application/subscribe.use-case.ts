import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import { EmailPreferenceRepository } from "../infrastructure/email-preference.repository";
import { ResendAudienceGateway } from "../infrastructure/resend-audience.gateway";
import { normalizeTrustedEmail } from "../domain/email-address";
import { ProviderSyncStatus } from "../domain/provider-sync-status";
import { SubscriptionStatusDto } from "./get-subscription-status.use-case";

export type SubscribeInput = {
  trustedEmail: string;
  audienceGateway?: Pick<ResendAudienceGateway, 'syncExplicitSubscribe'>;
};

export class SubscribeUseCase {
  static async execute(ctx: AppContext, input: SubscribeInput): Promise<SubscriptionStatusDto & { message: string; providerSyncStatus: ProviderSyncStatus }> {
    const mainChannel = await MainChannelService.getRequired(ctx);
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
       throw new Error("UserId is required for subscribe");
    }

    const trustedEmail = normalizeTrustedEmail(input.trustedEmail);
    if (!trustedEmail) {
      throw new Error("Trusted user email is required for subscribe");
    }

    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptionRepo = new SubscriptionRepository(tx);
      const preferenceRepo = new EmailPreferenceRepository(tx);

      const existing = await subscriptionRepo.findByUserIdAndCreatorId(userId, mainChannel.id);
      await preferenceRepo.recordExplicitContentOptIn(userId, trustedEmail, tx);

      if (existing) {
        return { subscription: existing, newlyCreated: false };
      }

      const created = await subscriptionRepo.create(userId, mainChannel.id, tx);
      await MainChannelService.incrementSubscribersCount(ctx, mainChannel.id, tx);

      return { subscription: created, newlyCreated: true };
    });

    const providerSyncStatus = await (input.audienceGateway ?? new ResendAudienceGateway()).syncExplicitSubscribe(trustedEmail);
    const finalChannel = await MainChannelService.getRequired(ctx);

    return {
      isSubscribed: true,
      subscribedAt: result.subscription.createdAt,
      subscribersCount: finalChannel.subscribersCount ?? 0,
      creatorId: mainChannel.id,
      creatorSlug: mainChannel.slug,
      purpose: "EMAIL_NOTIFICATIONS",
      providerSyncStatus,
      message: "Email notifications enabled for this channel.",
    };
  }
}
