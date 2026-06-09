import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PaymentStatus } from "@prisma/client";
import { PaymentDto } from "../domain/payment.dto";

export class PaymentRepository {
  async findUser(userId: string, db: ReadDb) {
    return await db.user.findUnique({
      where: { id: userId },
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

  async updateStripeCustomerId(userId: string, stripeCustomerId: string, tx: WriteTx) {
    await tx.user.update({
      where: { id: userId },
      data: { stripeCustomerId }
    });
  }
}
