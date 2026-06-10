import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { ReferralStatus } from "@prisma/client";

export class ReferralRepository {
  constructor(private db: ReadDb) {}

  private get referral() {
    return (this.db as any).referral;
  }

  async findByReferredId(referredId: string, tx?: WriteTx) {
    const db = tx || this.referral;
    return await db.findUnique({
      where: { referredId },
    });
  }

  async create(data: {
    referrerId: string;
    referredId: string;
    status: ReferralStatus;
    source: string;
    claimedAt: Date;
  }, tx?: WriteTx) {
    const db = tx || this.referral;
    return await db.create({
      data,
    });
  }
}
