import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PaymentStatus, Prisma } from "@prisma/client";
import { PaymentDto } from "../domain/payment.dto";

export class PaymentRepository {
  async findUser(userId: string, db: ReadDb) {
    return await db.user.findUnique({
      where: { id: userId },
    });
  }

  async findUserWithTotals(userId: string, db: ReadDb) {
    return await db.user.findUnique({
      where: { id: userId },
      include: { paymentTotals: true }
    });
  }

  async findPaymentByRequestId(userId: string, requestId: string, db: ReadDb): Promise<PaymentDto | null> {
    return await db.payment.findFirst({
      where: {
        userId,
        requestId,
      }
    }) as PaymentDto | null;
  }

  async findById(paymentId: string, db: ReadDb): Promise<PaymentDto | null> {
    return await db.payment.findUnique({
      where: { id: paymentId }
    }) as PaymentDto | null;
  }

  async findManyByUserId(userId: string, limit: number, db: ReadDb): Promise<PaymentDto[]> {
    return await db.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    }) as PaymentDto[];
  }

  async findByIntentId(stripeIntentId: string, db: ReadDb): Promise<PaymentDto | null> {
    return await db.payment.findUnique({
      where: { stripeIntentId }
    }) as PaymentDto | null;
  }

  async createPayment(data: {
    userId: string;
    creatorId: string;
    amountMinor: number;
    currency: string;
    status: PaymentStatus;
    metadata: any;
    requestId?: string | null;
  }, tx: WriteTx): Promise<PaymentDto> {
    return await tx.payment.create({
      data
    }) as PaymentDto;
  }

  async updatePayment(paymentId: string, data: Partial<PaymentDto>, tx: WriteTx): Promise<PaymentDto> {
    const { id, createdAt, updatedAt, ...updateData } = data;
    return await tx.payment.update({
      where: { id: paymentId },
      data: updateData as any
    }) as PaymentDto;
  }

  async updatePaymentStatusWithCAS(paymentId: string, oldStatus: PaymentStatus, newStatus: PaymentStatus, tx: WriteTx): Promise<number> {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: oldStatus },
      data: { status: newStatus }
    });
    return count;
  }

  async fulfillPendingPaymentWithCAS(payment: {
    id: string;
    currentStripeIntentId: string | null;
    stripeIntentId: string | null;
    amountMinor: number;
    currency: string;
  }, tx: WriteTx): Promise<number> {
    const data: Prisma.PaymentUpdateManyMutationInput = {
      status: PaymentStatus.SUCCEEDED,
    };

    if (!payment.currentStripeIntentId && payment.stripeIntentId) {
      data.stripeIntentId = payment.stripeIntentId;
    }

    const { count } = await tx.payment.updateMany({
      where: {
        id: payment.id,
        stripeIntentId: payment.currentStripeIntentId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        status: PaymentStatus.PENDING,
      },
      data
    });
    return count;
  }

  async updateRefundStatusWithCAS(paymentId: string, oldRefundedMinor: number, data: { status: PaymentStatus; refundedAmountMinor: number }, tx: WriteTx): Promise<number> {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, refundedAmountMinor: oldRefundedMinor },
      data
    });
    return count;
  }

  async updateStripeCustomerId(userId: string, stripeCustomerId: string, tx: WriteTx) {
    await tx.user.update({
      where: { id: userId },
      data: { stripeCustomerId }
    });
  }

  async incrementUserPaymentTotal(userId: string, currency: string, amountMinor: number, tx: WriteTx) {
    return await tx.userPaymentTotal.upsert({
      where: { userId_currency: { userId, currency } },
      create: {
        userId,
        currency,
        amountMinor
      },
      update: {
        amountMinor: { increment: amountMinor }
      }
    });
  }

  async decrementUserPaymentTotal(userId: string, currency: string, amountMinor: number, tx: WriteTx) {
    // Use raw SQL for atomic decrement with a clamp-to-zero invariant.
    // This prevents race conditions and ensures the total never goes below zero.
    // We use double quotes for Postgres table and column names as Prisma does.
    return await tx.$executeRaw`
      UPDATE "UserPaymentTotal"
      SET "amountMinor" = GREATEST(0, "amountMinor" - ${amountMinor})
      WHERE "userId" = ${userId} AND "currency" = ${currency}
    `;
  }

  async getCurrencySettings(db: ReadDb) {
    return await db.paymentCurrencySetting.findMany();
  }

  async upsertCurrencySetting(currency: string, minAmountMinor: number, tx: WriteTx) {
    return await tx.paymentCurrencySetting.upsert({
      where: { currency },
      create: { currency, minAmountMinor },
      update: { minAmountMinor }
    });
  }

  async countPayments(where: Prisma.PaymentWhereInput, db: ReadDb): Promise<number> {
    return await db.payment.count({ where });
  }

  async findPaymentsWithRelations(params: {
    where: Prisma.PaymentWhereInput;
    orderBy: Prisma.PaymentOrderByWithRelationInput;
    skip: number;
    take: number;
  }, db: ReadDb) {
    return await db.payment.findMany({
      where: params.where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            imageUrl: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
    });
  }

  async getFinancialStats(where: Prisma.PaymentWhereInput, db: ReadDb) {
    const succeededWhere = { ...where, status: PaymentStatus.SUCCEEDED };

    const succeeded = await db.payment.groupBy({
      by: ['currency'],
      where: succeededWhere,
      _sum: {
        amountMinor: true
      },
      _count: {
        id: true
      }
    });

    const refunded = await db.payment.groupBy({
      by: ['currency'],
      where,
      _sum: {
        refundedAmountMinor: true
      }
    });

    const countsPerStatus = await db.payment.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true
      }
    });

    return {
      succeeded: succeeded.map(s => ({
        currency: s.currency,
        totalAmount: s._sum.amountMinor || 0,
        count: s._count.id
      })),
      refunded: refunded.map(r => ({
        currency: r.currency,
        totalAmount: r._sum.refundedAmountMinor || 0
      })),
      statusCounts: countsPerStatus.map(c => ({
        status: c.status,
        count: c._count.id
      }))
    };
  }
}
