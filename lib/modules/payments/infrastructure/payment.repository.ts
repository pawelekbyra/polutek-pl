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

  async findPendingPaymentByRequestId(userId: string, requestId: string, db: ReadDb): Promise<PaymentDto | null> {
    return await db.payment.findFirst({
      where: {
        userId,
        status: PaymentStatus.PENDING,
        metadata: {
          path: ['requestId'],
          equals: requestId
        }
      }
    }) as PaymentDto | null;
  }

  async findById(paymentId: string, db: ReadDb): Promise<PaymentDto | null> {
    return await db.payment.findUnique({
      where: { id: paymentId }
    }) as PaymentDto | null;
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
    const total = await tx.userPaymentTotal.findUnique({
      where: { userId_currency: { userId, currency } },
      select: { amountMinor: true }
    });

    if (total) {
      return await tx.userPaymentTotal.update({
        where: { userId_currency: { userId, currency } },
        data: { amountMinor: Math.max(0, total.amountMinor - amountMinor) }
      });
    }
    return null;
  }
}
