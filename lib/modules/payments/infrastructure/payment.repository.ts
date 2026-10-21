import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PaymentStatus, Prisma } from "@prisma/client";
import { PaymentDto } from "../domain/payment.dto";

/** Local statuses a Stripe `succeeded` may still move to SUCCEEDED (see fulfillPaymentWithCAS). */
const FULFILLABLE_STATUSES: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELED];

/** Statuses of payments whose money was received (possibly refunded or disputed afterwards). */
const RECEIVED_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
  PaymentStatus.DISPUTED,
  PaymentStatus.CHARGEBACK_LOST,
];

export class PaymentRepository {
  async findUser(userId: string, db: ReadDb) {
    return await db.user.findUnique({
      where: { id: userId },
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

  /**
   * Atomic transition to SUCCEEDED once Stripe reports the intent `succeeded`.
   *
   * FAILED and CANCELED are not terminal for this transition: a PaymentIntent goes back to
   * `requires_payment_method` after a failed attempt (wrong BLIK code, declined card, failed 3DS)
   * and a later attempt on the same intent can still succeed. Stripe's `succeeded` (with the
   * amount, currency and intent checked by the caller) is the source of truth, so a row that an
   * earlier failure or our own cleanup marked FAILED/CANCELED must still be recorded as paid.
   */
  async fulfillPaymentWithCAS(payment: {
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
        status: { in: FULFILLABLE_STATUSES },
      },
      data
    });
    return count;
  }

  /** Marks a not-yet-paid payment CANCELED (abandoned or canceled intent). Never touches a paid one. */
  async markUnpaidPaymentCanceled(paymentId: string, tx: WriteTx): Promise<number> {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
      data: { status: PaymentStatus.CANCELED },
    });
    return count;
  }

  async updatePendingPaymentAmount(paymentId: string, amountMinor: number, currency: string, tx: WriteTx, metadata?: Prisma.InputJsonValue): Promise<number> {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: { amountMinor, currency, ...(metadata ? { metadata } : {}) },
    });
    return count;
  }

  /** Paid payments that still count as support: not (fully) refunded, not disputed or lost. */
  async findCountablePayments(userId: string, db: ReadDb) {
    const payments = await db.payment.findMany({
      where: { userId, status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] } },
      select: { id: true, amountMinor: true, refundedAmountMinor: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return payments.filter((payment) => payment.amountMinor > (payment.refundedAmountMinor ?? 0));
  }

  async updateRefundStatusWithCAS(paymentId: string, oldRefundedMinor: number, data: { status: PaymentStatus; refundedAmountMinor: number; refundedById?: string | null; refundedAt?: Date | null; refundReason?: string | null }, tx: WriteTx): Promise<number> {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, refundedAmountMinor: oldRefundedMinor },
      data
    });
    return count;
  }

  /**
   * Row lock for the rest of the transaction (`SELECT ... FOR UPDATE`). Refund reconciliation reads
   * Stripe while holding it, so two concurrent syncs apply Stripe's answers one after the other and
   * an older snapshot can never overwrite a newer one.
   */
  async lockPaymentRow(paymentId: string, tx: WriteTx): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
  }

  async markRefundsChecked(paymentId: string, at: Date, tx: WriteTx): Promise<void> {
    await tx.payment.updateMany({ where: { id: paymentId }, data: { refundsCheckedAt: at } });
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

  /** Saves the one tip minimum of a currency. */
  async upsertCurrencyMinimum(currency: string, minAmountMinor: number, tx: WriteTx) {
    const data = { minAmountMinor };
    return await tx.paymentCurrencySetting.upsert({
      where: { currency },
      create: { currency, ...data },
      update: data,
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
    // Gross: every payment where money was actually received, including ones refunded or disputed
    // later. Refunds are summed separately over the same set, so gross - refunded is the net.
    // (Counting only SUCCEEDED dropped partially refunded tips from the gross while their refunds
    // were still subtracted.) An explicit status filter from the caller still narrows the set.
    const callerStatus = where.status;
    const succeededWhere: Prisma.PaymentWhereInput = {
      ...where,
      AND: [
        { status: { in: RECEIVED_STATUSES } },
        ...(callerStatus ? [{ status: callerStatus }] : []),
      ],
    };
    delete succeededWhere.status;

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
