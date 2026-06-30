import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PatronGrantSource } from "@prisma/client";
import { PatronGrantDto } from "../domain/patron.dto";

export class PatronRepository {
  async findUserWithPaymentTotals(userId: string, db: ReadDb) {
    return await db.user.findUnique({
      where: { id: userId },
      include: { paymentTotals: true },
    });
  }

  async findActiveGrantByAdmin(userId: string, db: ReadDb): Promise<PatronGrantDto | null> {
    return await db.patronGrant.findFirst({
      where: { userId, source: PatronGrantSource.ADMIN, revokedAt: null },
    });
  }

  async findGrantByPaymentId(paymentId: string, db: ReadDb): Promise<PatronGrantDto | null> {
    return await db.patronGrant.findUnique({
      where: { paymentId },
    });
  }

  async findGrantByReferralId(referralId: string, db: ReadDb): Promise<PatronGrantDto | null> {
    return await db.patronGrant.findUnique({
      where: { referralId },
    });
  }

  async createGrant(data: {
    userId: string;
    source: PatronGrantSource;
    paymentId?: string;
    referralId?: string;
    grantedById?: string;
    reason?: string;
  }, tx: WriteTx): Promise<PatronGrantDto> {
    return await tx.patronGrant.create({
      data: {
        userId: data.userId,
        source: data.source,
        paymentId: data.paymentId,
        referralId: data.referralId,
        grantedById: data.grantedById,
        reason: data.reason,
      },
    });
  }

  async revokeGrantByPaymentId(paymentId: string, reason: string, tx: WriteTx) {
    return await tx.patronGrant.updateMany({
      where: { paymentId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        reason: reason,
      },
    });
  }

  async revokeActiveGrants(userId: string, reason: string, tx: WriteTx) {
    return await tx.patronGrant.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        reason: reason,
      },
    });
  }

  async listActiveGrants(userId: string, db: ReadDb): Promise<PatronGrantDto[]> {
    return await db.patronGrant.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findFirstActiveGrant(userId: string, db: ReadDb): Promise<PatronGrantDto | null> {
    return await db.patronGrant.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }
}
