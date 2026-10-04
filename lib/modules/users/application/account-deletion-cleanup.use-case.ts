import crypto from 'crypto';
import { AppContext } from '@/lib/modules/shared/app-context';
import { recordAuditEvent } from '@/lib/modules/audit';
import { resolveEmailLanguage, sendAccountDeletedEmail } from '@/lib/modules/email';

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

function deletedEmail(anonymousId: string) {
  return `deleted_${anonymousId}@deleted.com`;
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
      select: { id: true, email: true, isDeleted: true, language: true },
    });

    if (!user) return { cleaned: false, alreadyDeleted: true, originalEmail: null };

    const originalEmail = user.email && !user.email.startsWith('deleted_') ? user.email : null;
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
      await tx.userAvatar.deleteMany({ where: { userId: input.userId } });
      await tx.subscription.deleteMany({ where: { userId: input.userId } });
      await tx.emailPreference.deleteMany({
        where: {
          OR: [
            { userId: input.userId },
            ...(originalEmail ? [{ email: originalEmail }] : []),
          ],
        },
      });

      if (creatorIds.length > 0) await resyncCreatorSubscriberCounts(tx, creatorIds);

      await tx.user.update({
        where: { id: input.userId },
        data: {
          email: user.isDeleted && user.email.startsWith('deleted_') ? user.email : deletedEmail(anonymousId),
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
        metadata: { source: input.source, reason: input.reason ?? null, originalEmailRemoved: Boolean(originalEmail) },
      }, tx);

      return { cleaned: true, alreadyDeleted: user.isDeleted, originalEmail };
    });

    if (originalEmail) {
      await sendAccountDeletedEmail(originalEmail, resolveEmailLanguage(user.language)).catch((error) => {
        console.error('[AccountDeletionCleanup] Failed to send account deleted email:', error);
      });
    }

    return result;
  }
}
