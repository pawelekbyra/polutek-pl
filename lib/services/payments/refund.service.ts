import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { PaymentStatus, Prisma } from '@prisma/client';

type RefundCalculationInput = {
  amountMinor: number;
  refundedAmountMinor?: number | null;
};

export function calculateRefundAdjustment(payment: RefundCalculationInput, reportedRefundedMinor: number) {
  const previousRefunded = Math.max(0, payment.refundedAmountMinor ?? 0);
  const cappedRefunded = Math.max(0, Math.min(reportedRefundedMinor, payment.amountMinor));
  const deltaRefundMinor = Math.max(0, cappedRefunded - previousRefunded);
  const status = cappedRefunded >= payment.amountMinor
    ? PaymentStatus.REFUNDED
    : cappedRefunded > 0
      ? PaymentStatus.PARTIALLY_REFUNDED
      : undefined;

  return {
    previousRefunded,
    newRefundedAmountMinor: cappedRefunded,
    deltaRefundMinor,
    isFullRefund: cappedRefunded >= payment.amountMinor,
    status,
  };
}

export function calculateChargebackNetAdjustment(payment: RefundCalculationInput) {
  return Math.max(0, payment.amountMinor - Math.max(0, payment.refundedAmountMinor ?? 0));
}

export async function decrementUserNetPaymentTotals(
  tx: Prisma.TransactionClient,
  userId: string,
  currency: string,
  deltaMinor: number,
) {
  if (deltaMinor <= 0) return;

  const total = await tx.userPaymentTotal.findUnique({
    where: { userId_currency: { userId, currency } },
    select: { amountMinor: true },
  });

  if (total) {
    await tx.userPaymentTotal.update({
      where: { userId_currency: { userId, currency } },
      data: { amountMinor: Math.max(0, total.amountMinor - deltaMinor) },
    });
  }
}

export async function applyLostChargeback(
  tx: Prisma.TransactionClient,
  payment: { id: string; userId: string; currency: string; amountMinor: number; refundedAmountMinor?: number | null; status: PaymentStatus },
  disputeStatus: string,
) {
  const { count } = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: { not: PaymentStatus.CHARGEBACK_LOST }
    },
    data: { status: PaymentStatus.CHARGEBACK_LOST },
  });

  if (count === 0) {
    logger.info(`[PaymentRefundService] Payment ${payment.id} already marked as CHARGEBACK_LOST or not found.`);
    return;
  }

  await decrementUserNetPaymentTotals(
    tx,
    payment.userId,
    payment.currency,
    calculateChargebackNetAdjustment(payment),
  );

  await tx.patronGrant.updateMany({
    where: { paymentId: payment.id, revokedAt: null },
    data: { revokedAt: new Date(), reason: `Payment disputed: ${disputeStatus}` },
  });
}

/**
 * @deprecated Use handleRefund or handleDispute use cases from @/lib/modules/payments.
 * R10 cleanup candidate.
 */
export class PaymentRefundService {
  static calculateRefundAdjustment = calculateRefundAdjustment;
  static calculateChargebackNetAdjustment = calculateChargebackNetAdjustment;
  static applyLostChargeback = applyLostChargeback;
  static decrementUserTotals = decrementUserNetPaymentTotals;
}
