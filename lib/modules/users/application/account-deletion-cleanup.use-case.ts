import crypto from 'crypto';
import { AppContext } from '@/lib/modules/shared/app-context';
import { recordAuditEvent } from '@/lib/modules/audit';
import { sendAccountDeletedEmail } from '@/lib/modules/email';

export type AccountDeletionCleanupSource = 'CLERK_WEBHOOK' | 'APP_ACCOUNT_DELETION' | 'CLERK_RECONCILIATION';

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
      select: { id: true, email: true, isDeleted: true },
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
        action: 'USER_ACCOUNT_DELETION_CLEANUP',
        targetType: 'User',
        targetId: input.userId,
        metadata: { source: input.source, reason: input.reason ?? null, originalEmailRemoved: Boolean(originalEmail) },
      }, tx);

      return { cleaned: true, alreadyDeleted: user.isDeleted, originalEmail };
    });

    if (originalEmail) {
      await sendAccountDeletedEmail(originalEmail).catch((error) => {
        console.error('[AccountDeletionCleanup] Failed to send account deleted email:', error);
      });
    }

    return result;
  }
}
