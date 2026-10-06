import { AppContext } from '@/lib/modules/shared/app-context';
import { MainChannelService } from '@/lib/modules/channel';
import { flags } from '@/lib/feature-flags';
import { createScopedLogger } from '@/lib/logger';
import { verifyContentUnsubscribeToken } from '../domain/signed-unsubscribe-token';
import { EmailPreferenceRepository } from '../infrastructure/email-preference.repository';

export type UnsubscribeLanguage = 'pl' | 'en';

/**
 * `invalid`: the link is not one we signed (typo, truncated by a mail client, or the signing secret
 * changed without keeping the old one). It reveals nothing about any account: a valid token can only
 * come from a mail we sent to its owner.
 */
export type SignedUnsubscribeResult =
  | { status: 'unsubscribed'; language: UnsubscribeLanguage }
  | { status: 'invalid'; language: null };

function toLanguage(value: string | null | undefined): UnsubscribeLanguage {
  return value === 'en' ? 'en' : 'pl';
}

/**
 * Turns content notifications off for one user: removes the channel subscription, records the opt-out and
 * keeps the channel's subscriber count right. Idempotent. Used by the signed unsubscribe link and, with the
 * same semantics, when a spam complaint arrives. Returns the user's language (pl when unknown).
 */
export async function unsubscribeUserFromContentNotifications(ctx: AppContext, userId: string): Promise<UnsubscribeLanguage> {
  return ctx.db.writeTransaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, language: true },
    });
    if (!user?.email) return 'pl' as const;

    const mainCreator = flags.mainCreatorSlug
      ? await tx.creator.findUnique({ where: { slug: flags.mainCreatorSlug }, select: { id: true } })
      : null;

    if (mainCreator) {
      const deleted = await tx.subscription.deleteMany({ where: { userId: user.id, creatorId: mainCreator.id } });
      if (deleted.count > 0) await MainChannelService.syncSubscribersCount(ctx, mainCreator.id, tx);
    }

    const preferenceRepo = new EmailPreferenceRepository(tx);
    const result = await preferenceRepo.recordExplicitContentOptOut(user.id, user.email, tx);
    if (!result.recorded) {
      createScopedLogger(ctx.requestId ?? null).warn(`[SIGNED_UNSUBSCRIBE] preference not recorded reason=${result.reason}`);
    }
    return toLanguage(user.language);
  });
}

export class SignedContentUnsubscribeUseCase {
  /** Read-only: whether the link is ours and in which language to talk to its owner. */
  static async inspect(ctx: AppContext, token: string | null | undefined): Promise<{ valid: boolean; language: UnsubscribeLanguage | null }> {
    const verified = verifyContentUnsubscribeToken(token);
    if (!verified.ok) return { valid: false, language: null };
    try {
      const user = await ctx.db.read.user.findUnique({ where: { id: verified.subject }, select: { language: true } });
      return { valid: true, language: user ? toLanguage(user.language) : null };
    } catch {
      return { valid: true, language: null };
    }
  }

  /**
   * Turns content notifications off for the token's user: removes the channel subscription, records
   * the opt-out and keeps the channel's subscriber count right. Idempotent; a token of a deleted
   * account is accepted and does nothing.
   */
  static async execute(ctx: AppContext, token: string | null | undefined): Promise<SignedUnsubscribeResult> {
    const verified = verifyContentUnsubscribeToken(token);
    if (!verified.ok) return { status: 'invalid', language: null };

    const language = await unsubscribeUserFromContentNotifications(ctx, verified.subject);

    return { status: 'unsubscribed', language };
  }
}
