import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PrismaClient } from "@prisma/client";

export class EmailPreferenceRepository {
  constructor(private db: ReadDb) {}

  /**
   * LEGACY: marketingEmails is the historical technical field name for
   * consent to receive content notifications, not patron/access state.
   */
  async recordExplicitContentOptIn(userId: string, email: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);

    const byUserId = await db.emailPreference.findUnique({ where: { userId } });
    if (byUserId) {
      const emailConflict = byUserId.email !== email && await db.emailPreference.findUnique({ where: { email } });
      try {
        return await db.emailPreference.update({
          where: { id: byUserId.id },
          data: {
            marketingEmails: true,
            unsubscribedAt: null,
            ...(emailConflict ? {} : { email }),
          },
          select: { id: true },
        });
      } catch (error: any) {
        if (error.code === 'P2002') return { id: byUserId.id };
        throw error;
      }
    }

    const byEmail = await db.emailPreference.findUnique({ where: { email } });
    if (byEmail) {
      if (!byEmail.userId || byEmail.userId === userId) {
        return await db.emailPreference.update({
          where: { id: byEmail.id },
          data: { userId, marketingEmails: true, unsubscribedAt: null },
          select: { id: true },
        });
      }
      return { id: byEmail.id };
    }

    try {
      return await db.emailPreference.create({
        data: { userId, email, marketingEmails: true, systemEmails: true, unsubscribedAt: null },
        select: { id: true },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const retryByUserId = await db.emailPreference.findUnique({ where: { userId } });
        if (retryByUserId) return { id: retryByUserId.id };
        const retryByEmail = await db.emailPreference.findUnique({ where: { email } });
        if (retryByEmail) return { id: retryByEmail.id };
      }
      throw error;
    }
  }

  /**
   * LEGACY: marketingEmails=false is the local negative override for
   * content notifications. It does not affect system/transactional email.
   */
  async recordExplicitContentOptOut(userId: string, email: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);

    const byUserId = await db.emailPreference.findUnique({ where: { userId } });
    if (byUserId) {
      const emailConflict = byUserId.email !== email && await db.emailPreference.findUnique({ where: { email } });
      try {
        return await db.emailPreference.update({
          where: { id: byUserId.id },
          data: {
            marketingEmails: false,
            unsubscribedAt: new Date(),
            ...(emailConflict ? {} : { email }),
          },
          select: { id: true },
        });
      } catch (error: any) {
        if (error.code === 'P2002') return { id: byUserId.id };
        throw error;
      }
    }

    const byEmail = await db.emailPreference.findUnique({ where: { email } });
    if (byEmail) {
      if (!byEmail.userId || byEmail.userId === userId) {
        return await db.emailPreference.update({
          where: { id: byEmail.id },
          data: { userId, marketingEmails: false, unsubscribedAt: new Date() },
          select: { id: true },
        });
      }
      return { id: byEmail.id };
    }

    try {
      return await db.emailPreference.create({
        data: { userId, email, marketingEmails: false, systemEmails: true, unsubscribedAt: new Date() },
        select: { id: true },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const retryByUserId = await db.emailPreference.findUnique({ where: { userId } });
        if (retryByUserId) return { id: retryByUserId.id };
        const retryByEmail = await db.emailPreference.findUnique({ where: { email } });
        if (retryByEmail) return { id: retryByEmail.id };
      }
      throw error;
    }
  }
}
