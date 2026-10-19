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

  /**
   * A preference row belongs to the address it was recorded for. When its owner later changed their e-mail (or the
   * account is gone), the row still carries the old address and would block anybody else who now uses that address
   * ("This e-mail address is already linked to another account"). Such a leftover is released: it keeps its consent
   * state under the owner's current address, or is dropped when there is no such owner. Returns whether the row was
   * released (the address is free for the caller). A row whose owner still has that address is a real conflict.
   */
  private async releaseIfStale(
    db: PrismaClient | WriteTx,
    row: { id: string; userId: string | null; email: string },
  ): Promise<boolean> {
    if (!row.userId) return false;
    const owner = await db.user.findUnique({ where: { id: row.userId }, select: { email: true, isDeleted: true } });
    const ownerEmail = owner && !owner.isDeleted ? owner.email?.trim().toLowerCase() : null;
    if (ownerEmail && ownerEmail === row.email.trim().toLowerCase()) return false;
    try {
      if (ownerEmail) {
        await db.emailPreference.update({ where: { id: row.id }, data: { email: ownerEmail }, select: { id: true } });
      } else {
        await db.emailPreference.delete({ where: { id: row.id } });
      }
    } catch (error) {
      if (!isPrismaErrorCode(error, 'P2002')) throw error;
      // The owner's current address is taken by yet another row: the stale one is of no use any more.
      await db.emailPreference.delete({ where: { id: row.id } });
    }
    return true;
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
      let emailConflict = byUserId.email !== email && (await db.emailPreference.findUnique({ where: { email } }));
      if (consentData.marketingEmails && emailConflict && emailConflict.userId && emailConflict.userId !== userId && (await this.releaseIfStale(db, emailConflict))) {
        emailConflict = null;
      }

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
    let byEmail = await db.emailPreference.findUnique({ where: { email } });
    if (consentData.marketingEmails && byEmail && byEmail.userId && byEmail.userId !== userId && (await this.releaseIfStale(db, byEmail))) {
      byEmail = null;
    }
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
