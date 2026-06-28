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

  async createGrant(data: {
    userId: string;
    source: PatronGrantSource;
    paymentId?: string;
    grantedById?: string;
    reason?: string;
  }, tx: WriteTx): Promise<PatronGrantDto> {
    return await tx.patronGrant.create({
      data: {
        userId: data.userId,
        source: data.source,
        paymentId: data.paymentId,
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

  async updateUserPatronFields(
    userId: string,
    data: {
      isPatron: boolean;
      patronSince: Date | null;
      patronSource: PatronGrantSource | null;
    },
    tx: WriteTx,
    options?: { preserveExistingPatronSince?: boolean }
  ) {
    type PatronUserUpdateData = {
      isPatron: boolean;
      patronSource: PatronGrantSource | null;
      patronSince?: Date | null;
    };

    const updateData: PatronUserUpdateData = {
      isPatron: data.isPatron,
      patronSource: data.patronSource,
    };

    let shouldUpdatePatronSince = true;

    if (options?.preserveExistingPatronSince) {
      const existing = await tx.user.findUnique({
        where: { id: userId },
        select: { patronSince: true },
      });
      if (existing?.patronSince) {
        shouldUpdatePatronSince = false;
      }
    }

    if (shouldUpdatePatronSince) {
      updateData.patronSince = data.patronSince;
    }

    return await tx.user.update({
      where: { id: userId },
      data: updateData,
      include: { paymentTotals: true },
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
