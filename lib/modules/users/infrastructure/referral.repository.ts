import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { ReferralStatus } from "@prisma/client";

export class ReferralRepository {
  constructor(private db: ReadDb) {}

  async findByReferredId(referredId: string, tx?: WriteTx) {
    const db = tx || (this.db as
any);
    return await db.referral.findUnique({
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
    const db = tx || (this.db as
any);
    return await db.referral.create({
      data,
    });
  }
}
