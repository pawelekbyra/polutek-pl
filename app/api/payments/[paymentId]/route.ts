import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { PaymentStatus } from '@prisma/client';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

type PaymentUiStatus = 'PENDING_WEBHOOK' | 'SUCCEEDED' | 'FAILED_CANCELED' | 'REFUNDED_DISPUTED' | 'ACCESS_SYNC_PENDING';

function toUiStatus(status: PaymentStatus, hasActiveGrant: boolean): PaymentUiStatus {
  if (status === PaymentStatus.SUCCEEDED && !hasActiveGrant) return 'ACCESS_SYNC_PENDING';
  if (status === PaymentStatus.SUCCEEDED) return 'SUCCEEDED';
  if (status === PaymentStatus.FAILED || status === PaymentStatus.CANCELED) return 'FAILED_CANCELED';
  if (status === PaymentStatus.REFUNDED || status === PaymentStatus.PARTIALLY_REFUNDED || status === PaymentStatus.DISPUTED || status === PaymentStatus.CHARGEBACK_LOST) return 'REFUNDED_DISPUTED';
  return 'PENDING_WEBHOOK';
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { paymentId } = await params;
    const ctx = createAppContext({ actor: { type: 'user', userId, isPatron: false } });
    const payment = await ctx.db.read.payment.findFirst({
      where: { id: paymentId, userId },
      select: { id: true, status: true, amountMinor: true, currency: true, refundedAmountMinor: true, updatedAt: true },
    });

    if (!payment) return NextResponse.json({ error: 'PAYMENT_NOT_FOUND' }, { status: 404 });

    const activeGrant = await ctx.db.read.patronGrant.findFirst({
      where: { paymentId: payment.id, userId, revokedAt: null },
      select: { id: true },
    });

    return NextResponse.json({
      paymentId: payment.id,
      status: payment.status,
      uiStatus: toUiStatus(payment.status, Boolean(activeGrant)),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      refundedAmountMinor: payment.refundedAmountMinor,
      accessSynced: payment.status !== PaymentStatus.SUCCEEDED || Boolean(activeGrant),
      updatedAt: payment.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
