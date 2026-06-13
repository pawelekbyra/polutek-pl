import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PrismaClient } from "@prisma/client";
import { isPrismaErrorCode } from "@/lib/utils/db";

export type EmailPreferenceResult = {
  id: string | null;
  recorded: boolean;
  reason?: 'FOREIGN_EMAIL_CONFLICT';
};

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
    const optOutTimestamp = new Date();
    const data = { marketingEmails: false, unsubscribedAt: optOutTimestamp };
    return this.upsertPreference(userId, email, data, tx);
  }

  private async upsertPreference(
    userId: string,
    email: string,
    consentData: { marketingEmails: boolean; unsubscribedAt: Date | null },
    tx?: WriteTx
  ): Promise<EmailPreferenceResult> {
    const db = tx || (this.db as PrismaClient);

    // Step 1 — lookup by userId
    const byUserId = await db.emailPreference.findUnique({ where: { userId } });
    if (byUserId) {
      const emailConflict = byUserId.email !== email && (await db.emailPreference.findUnique({ where: { email } }));

      // If the email belongs to another registered user, it's a conflict for opt-in
      if (emailConflict && emailConflict.userId && emailConflict.userId !== userId && consentData.marketingEmails) {
        return { id: null, recorded: false, reason: 'FOREIGN_EMAIL_CONFLICT' };
      }

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
        if (isPrismaErrorCode(error, 'P2002')) {
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

    // Step 2 — no record by userId, lookup by email
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
          if (isPrismaErrorCode(error, 'P2002')) {
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

    // Step 3 — no records found, create
    try {
      const created = await db.emailPreference.create({
        data: { userId, email, systemEmails: true, ...consentData },
        select: { id: true },
      });
      return { id: created.id, recorded: true };
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
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
