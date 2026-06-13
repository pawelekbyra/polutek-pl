import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PrismaClient } from "@prisma/client";

export type EmailPreferenceResult = {
  id: string | null;
  recorded: boolean;
  reason?: 'FOREIGN_EMAIL_CONFLICT';
};

function isPrismaUniqueConstraintError(
  error: unknown
): error is { code: 'P2002' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export class EmailPreferenceRepository {
  constructor(private db: ReadDb) {}

  /**
   * LEGACY: marketingEmails is the historical technical field name for
   * consent to receive content notifications, not patron/access state.
   */
  async recordExplicitContentOptIn(userId: string, email: string, tx?: WriteTx): Promise<EmailPreferenceResult> {
    const data = { marketingEmails: true, unsubscribedAt: null };
    return this.upsertPreference(userId, email, data, tx);
  }

  /**
   * LEGACY: marketingEmails=false is the local negative override for
   * content notifications. It does not affect system/transactional email.
   */
  async recordExplicitContentOptOut(userId: string, email: string, tx?: WriteTx): Promise<EmailPreferenceResult> {
    const data = { marketingEmails: false, unsubscribedAt: new Date() };
    return this.upsertPreference(userId, email, data, tx);
  }

  private async upsertPreference(
    userId: string,
    email: string,
    consentData: { marketingEmails: boolean; unsubscribedAt: Date | null },
    tx?: WriteTx
  ): Promise<EmailPreferenceResult> {
    const db = tx || (this.db as PrismaClient);

    // lookup by userId
    const byUserId = await db.emailPreference.findUnique({ where: { userId } });
    if (byUserId) {
      const emailConflict = byUserId.email !== email && (await db.emailPreference.findUnique({ where: { email } }));
      try {
        const updated = await db.emailPreference.update({
          where: { id: byUserId.id },
          data: {
            ...consentData,
            ...(emailConflict ? {} : { email }),
          },
          select: { id: true },
        });
        return { id: updated.id, recorded: true };
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          const fallback = await db.emailPreference.update({
            where: { id: byUserId.id },
            data: consentData,
            select: { id: true },
          });
          return { id: fallback.id, recorded: true };
        }
        throw error;
      }
    }

    // lookup by email
    const byEmail = await db.emailPreference.findUnique({ where: { email } });
    if (byEmail) {
      if (!byEmail.userId || byEmail.userId === userId) {
        try {
          const updated = await db.emailPreference.update({
            where: { id: byEmail.id },
            data: { userId, ...consentData },
            select: { id: true },
          });
          return { id: updated.id, recorded: true };
        } catch (error) {
          if (isPrismaUniqueConstraintError(error)) {
            const retryByUserId = await db.emailPreference.findUnique({ where: { userId } });
            if (retryByUserId) {
              const fallback = await db.emailPreference.update({
                where: { id: retryByUserId.id },
                data: consentData,
                select: { id: true },
              });
              return { id: fallback.id, recorded: true };
            }
            const retryByEmail = await db.emailPreference.findUnique({ where: { email } });
            if (retryByEmail && (!retryByEmail.userId || retryByEmail.userId === userId)) {
               const fallback = await db.emailPreference.update({
                  where: { id: retryByEmail.id },
                  data: { userId, ...consentData },
                  select: { id: true }
               });
               return { id: fallback.id, recorded: true };
            }
          }
          throw error;
        }
      }
      return { id: null, recorded: false, reason: 'FOREIGN_EMAIL_CONFLICT' };
    }

    // create
    try {
      const created = await db.emailPreference.create({
        data: { userId, email, systemEmails: true, ...consentData },
        select: { id: true },
      });
      return { id: created.id, recorded: true };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        const retryByUserId = await db.emailPreference.findUnique({ where: { userId } });
        if (retryByUserId) {
          const fallback = await db.emailPreference.update({
            where: { id: retryByUserId.id },
            data: consentData,
            select: { id: true },
          });
          return { id: fallback.id, recorded: true };
        }
        const retryByEmail = await db.emailPreference.findUnique({ where: { email } });
        if (retryByEmail) {
          if (retryByEmail.userId === userId || !retryByEmail.userId) {
            const fallback = await db.emailPreference.update({
              where: { id: retryByEmail.id },
              data: { userId, ...consentData },
              select: { id: true },
            });
            return { id: fallback.id, recorded: true };
          }
          return { id: null, recorded: false, reason: 'FOREIGN_EMAIL_CONFLICT' };
        }
      }
      throw error;
    }
  }
}
