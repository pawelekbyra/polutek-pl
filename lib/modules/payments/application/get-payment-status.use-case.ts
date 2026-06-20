import { PaymentStatus } from '@prisma/client';
import { AppContext } from '@/lib/modules/shared/app-context';
import { UseCaseResult, ok, fail } from '@/lib/modules/shared/result';
import { PaymentError } from '../domain/payment.errors';

export type PaymentUiStatus = 'PENDING_WEBHOOK' | 'SUCCEEDED' | 'ACCESS_SYNC_PENDING' | 'FAILED_CANCELED' | 'REFUNDED_DISPUTED';

function toUiStatus(status: PaymentStatus, hasActiveGrant: boolean): PaymentUiStatus {
  if (status === PaymentStatus.SUCCEEDED) return hasActiveGrant ? 'SUCCEEDED' : 'ACCESS_SYNC_PENDING';
  if (status === PaymentStatus.FAILED || status === PaymentStatus.CANCELED) return 'FAILED_CANCELED';
  if (status === PaymentStatus.REFUNDED || status === PaymentStatus.PARTIALLY_REFUNDED || status === PaymentStatus.DISPUTED || status === PaymentStatus.CHARGEBACK_LOST) return 'REFUNDED_DISPUTED';
  return 'PENDING_WEBHOOK';
}

export async function getOwnedPaymentStatus(
  input: { paymentId: string; userId: string },
  ctx: AppContext,
): Promise<UseCaseResult<{
  id: string;
  status: PaymentStatus;
  uiStatus: PaymentUiStatus;
  accessSynced: boolean;
  amountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
} | null, PaymentError>> {
  try {
    const payment = await ctx.db.read.payment.findFirst({
      where: { id: input.paymentId, userId: input.userId },
      select: {
        id: true,
        userId: true,
        amountMinor: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!payment) return ok(null);

    const activeGrant = await ctx.db.read.patronGrant.findFirst({
      where: { paymentId: payment.id, userId: payment.userId, revokedAt: null },
      select: { id: true },
    });

    const accessSynced = payment.status === PaymentStatus.SUCCEEDED && Boolean(activeGrant);

    return ok({
      id: payment.id,
      status: payment.status,
      uiStatus: toUiStatus(payment.status, Boolean(activeGrant)),
      accessSynced,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    });
  } catch (error) {
    return fail(new PaymentError(error instanceof Error ? error.message : 'Payment status lookup failed'));
  }
}
