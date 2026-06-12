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
    return await db.emailPreference.upsert({
      where: { email },
      update: {
        userId,
        marketingEmails: true,
        unsubscribedAt: null,
      },
      create: {
        userId,
        email,
        marketingEmails: true,
        systemEmails: true,
        unsubscribedAt: null,
      },
      select: { id: true },
    });
  }

  /**
   * LEGACY: marketingEmails=false is the local negative override for
   * content notifications. It does not affect system/transactional email.
   */
  async recordExplicitContentOptOut(userId: string, email: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    return await db.emailPreference.upsert({
      where: { email },
      update: {
        userId,
        marketingEmails: false,
        unsubscribedAt: new Date(),
      },
      create: {
        userId,
        email,
        marketingEmails: false,
        systemEmails: true,
        unsubscribedAt: new Date(),
      },
      select: { id: true },
    });
  }
}
