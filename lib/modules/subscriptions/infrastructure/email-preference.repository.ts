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
      return await db.emailPreference.update({
        where: { id: byUserId.id },
        data: {
          marketingEmails: true,
          unsubscribedAt: null,
          ...(emailConflict ? {} : { email }),
        },
        select: { id: true },
      });
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

    return await db.emailPreference.create({
      data: { userId, email, marketingEmails: true, systemEmails: true, unsubscribedAt: null },
      select: { id: true },
    });
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
      return await db.emailPreference.update({
        where: { id: byUserId.id },
        data: {
          marketingEmails: false,
          unsubscribedAt: new Date(),
          ...(emailConflict ? {} : { email }),
        },
        select: { id: true },
      });
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

    return await db.emailPreference.create({
      data: { userId, email, marketingEmails: false, systemEmails: true, unsubscribedAt: new Date() },
      select: { id: true },
    });
  }
}
