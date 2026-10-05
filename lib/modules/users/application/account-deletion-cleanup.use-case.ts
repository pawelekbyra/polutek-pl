import crypto from 'crypto';
import { BroadcastRecipientStatus, CommentDeletedReason, CommentStatus } from '@prisma/client';
import { AppContext } from '@/lib/modules/shared/app-context';
import { recordAuditEvent } from '@/lib/modules/audit';
import { resolveEmailLanguage, sendAccountDeletedEmail } from '@/lib/modules/email';
import { enqueueContactRemovals, processContactRemovals } from '@/lib/modules/subscriptions';
import { enqueueStripeCustomerAnonymization, processStripeCustomerAnonymizations } from '@/lib/modules/payments';
import { logger } from '@/lib/logger';

/** APP_ACCOUNT_DELETION: the user deleted their own account. ADMIN_USER_DELETION: an admin deleted it (/admin/users). */
export type AccountDeletionCleanupSource = 'APP_ACCOUNT_DELETION' | 'ADMIN_USER_DELETION';

const AUDIT_ACTION: Record<AccountDeletionCleanupSource, string> = {
  APP_ACCOUNT_DELETION: 'USER_ACCOUNT_DELETION_CLEANUP',
  ADMIN_USER_DELETION: 'ADMIN_USER_DELETED',
};

export interface AccountDeletionCleanupResult {
  cleaned: boolean;
  alreadyDeleted: boolean;
  originalEmail: string | null;
}

/** How long the deletion request waits for Resend before leaving the contact removal to the daily cron. */
const CONTACT_REMOVAL_WAIT_MS = 5000;

/** `.invalid` is reserved (RFC 2606): a tombstone address can never reach a real mailbox. */
function deletedEmail(anonymousId: string) {
  return `deleted_${anonymousId}@deleted.invalid`;
}

/** Placeholder payload for e-mail webhook events whose recipient deleted the account. */
const REDACTED_EMAIL_EVENT_PAYLOAD = { redacted: 'ACCOUNT_DELETED' };

/**
 * Comment content goes with the account; the rows stay (like a comment its author deleted), so
 * replies by other people keep their thread and counters stay right. Comments already deleted keep
 * their deletion reason, everything else becomes "deleted by the author".
 */
async function eraseCommentContent(tx: any, userId: string, now: Date) {
  await tx.comment.updateMany({
    where: { authorId: userId, status: { not: CommentStatus.DELETED } },
    data: { status: CommentStatus.DELETED, deletedAt: now, deletedById: userId, deletedReason: CommentDeletedReason.AUTHOR_DELETED },
  });
  await tx.comment.updateMany({
    where: { authorId: userId, OR: [{ text: { not: '' } }, { imageUrl: { not: null } }] },
    data: { text: '', imageUrl: null },
  });
}

/**
 * E-mail history keeps its delivery facts (counts, statuses) but not the address: broadcast
 * recipients get the tombstone address, webhook events lose the address and their payload.
 */
async function anonymizeEmailHistory(tx: any, userId: string, emails: string[], tombstoneEmail: string) {
  const byOwner = [{ userId }, ...(emails.length ? [{ email: { in: emails } }] : [])];
  await tx.broadcastEmailRecipient.updateMany({
    where: { OR: byOwner, status: BroadcastRecipientStatus.PENDING },
    data: { status: BroadcastRecipientStatus.SKIPPED, error: 'ACCOUNT_DELETED' },
  });
  await tx.broadcastEmailRecipient.updateMany({ where: { OR: byOwner }, data: { email: tombstoneEmail } });
  await tx.emailEvent.updateMany({ where: { OR: byOwner }, data: { email: null, payload: REDACTED_EMAIL_EVENT_PAYLOAD } });
}

async function settleContactRemovals(ctx: AppContext, emails: string[]) {
  if (emails.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      processContactRemovals(ctx, { emails }),
      new Promise((resolve) => { timer = setTimeout(resolve, CONTACT_REMOVAL_WAIT_MS); }),
    ]);
  } catch (error) {
    // Still queued: /api/cron/retention retries it.
    logger.warn('[AccountDeletionCleanup] Resend contact removal deferred to the retention cron', error instanceof Error ? error.message : String(error));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Same bounded, best-effort wait for the Stripe Customer erasure; what is left is retried by /api/cron/retention. */
async function settleStripeCustomerAnonymization(ctx: AppContext, stripeCustomerIds: string[]) {
  if (stripeCustomerIds.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      processStripeCustomerAnonymizations(ctx, { stripeCustomerIds }),
      new Promise((resolve) => { timer = setTimeout(resolve, CONTACT_REMOVAL_WAIT_MS); }),
    ]);
  } catch (error) {
    logger.warn('[AccountDeletionCleanup] Stripe customer anonymization deferred to the retention cron', error instanceof Error ? error.message : String(error));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resyncCreatorSubscriberCounts(tx: any, creatorIds: string[]) {
  for (const creatorId of [...new Set(creatorIds)]) {
    const activeCount = await tx.subscription.count({ where: { creatorId } });
    await tx.creator.updateMany({ where: { id: creatorId }, data: { subscribersCount: activeCount } });
  }
}

export class AccountDeletionCleanupUseCase {
  static async execute(
    ctx: AppContext,
    input: { userId: string; source: AccountDeletionCleanupSource; reason?: string }
  ): Promise<AccountDeletionCleanupResult> {
    const now = ctx.now();
    const anonymousId = crypto.randomUUID();
    const user = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, isDeleted: true, language: true, stripeCustomerId: true },
    });

    if (!user) return { cleaned: false, alreadyDeleted: true, originalEmail: null };

    const originalEmail = user.email && !user.email.startsWith('deleted_') ? user.email : null;
    const tombstoneEmail = user.isDeleted && user.email.startsWith('deleted_') ? user.email : deletedEmail(anonymousId);
    let contactEmails: string[] = [];
    const stripeCustomerIds: string[] = user.stripeCustomerId ? [user.stripeCustomerId] : [];
    const result = await ctx.db.writeTransaction(async (tx) => {
      const subscriptions = await tx.subscription.findMany({
        where: { userId: input.userId },
        select: { creatorId: true },
      });
      const creatorIds = subscriptions.map((subscription: { creatorId: string }) => subscription.creatorId);

      await tx.patronGrant.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: {
          revokedAt: now,
          reason: input.reason ?? `Account deleted via ${input.source}`,
        },
      });

      // The row stays as an anonymized tombstone (comments and payments keep their owner), but
      // nothing may sign in to it again: drop every session and login method.
      await tx.session.deleteMany({ where: { userId: input.userId } });
      await tx.account.deleteMany({ where: { userId: input.userId } });
      await tx.twoFactor.deleteMany({ where: { userId: input.userId } });
      await tx.passkey.deleteMany({ where: { userId: input.userId } });
      await tx.userAvatar.deleteMany({ where: { userId: input.userId } });
      await tx.subscription.deleteMany({ where: { userId: input.userId } });

      const preferenceWhere = {
        OR: [
          { userId: input.userId },
          ...(originalEmail ? [{ email: originalEmail }] : []),
        ],
      };
      // A preference row exists only for someone who answered the e-mail consent question, i.e. the
      // only people who can have a contact in the Resend Audience: that contact is removed too.
      const preferences: { email: string }[] = await tx.emailPreference.findMany({ where: preferenceWhere, select: { email: true } });
      contactEmails = [...new Set(preferences.map((preference) => preference.email))];
      await enqueueContactRemovals(tx, contactEmails, now);
      await tx.emailPreference.deleteMany({ where: preferenceWhere });

      if (creatorIds.length > 0) await resyncCreatorSubscriberCounts(tx, creatorIds);

      await eraseCommentContent(tx, input.userId, now);
      await anonymizeEmailHistory(tx, input.userId, [...new Set([...(originalEmail ? [originalEmail] : []), ...contactEmails])], tombstoneEmail);

      // PA-03: the Stripe Customer holds the e-mail; queue its erasure in this transaction (the Payment ledger stays).
      await enqueueStripeCustomerAnonymization(tx, stripeCustomerIds.map((stripeCustomerId) => ({ stripeCustomerId, userId: input.userId })), now);

      await tx.user.update({
        where: { id: input.userId },
        data: {
          email: tombstoneEmail,
          name: 'Usunięty Użytkownik',
          username: user.isDeleted ? undefined : `deleted_${anonymousId.split('-')[0]}`,
          imageUrl: null,
          stripeCustomerId: null,
          isDeleted: true,
        },
      });

      await recordAuditEvent(ctx, {
        // One row per deletion, written in the same transaction; the actor (user, system or admin) comes from ctx.
        action: AUDIT_ACTION[input.source],
        targetType: 'User',
        targetId: input.userId,
        metadata: {
          source: input.source,
          reason: input.reason ?? null,
          originalEmailRemoved: Boolean(originalEmail),
          contactRemovalsQueued: contactEmails.length,
          stripeCustomersQueued: stripeCustomerIds.length,
        },
      }, tx);

      return { cleaned: true, alreadyDeleted: user.isDeleted, originalEmail };
    });

    // Best effort and bounded: a slow or unreachable Resend never blocks the deletion.
    await settleContactRemovals(ctx, contactEmails);
    await settleStripeCustomerAnonymization(ctx, stripeCustomerIds);

    if (originalEmail) {
      await sendAccountDeletedEmail(originalEmail, resolveEmailLanguage(user.language)).catch((error) => {
        console.error('[AccountDeletionCleanup] Failed to send account deleted email:', error);
      });
    }

    return result;
  }
}
