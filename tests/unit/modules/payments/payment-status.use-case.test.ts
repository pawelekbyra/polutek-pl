import { describe, expect, it } from 'vitest';
import { PaymentStatus } from '@prisma/client';
import { getOwnedPaymentStatus } from '@/lib/modules/payments/application/get-payment-status.use-case';

function ctxFor(payment: any, grant: any = null): any {
  return {
    db: { read: {
      payment: { findFirst: async ({ where }: any) => payment && payment.id === where.id && payment.userId === where.userId ? payment : null },
      patronGrant: { findFirst: async () => grant },
    }},
  };
}

const base = { id: 'pay_1', userId: 'user_1', amountMinor: 1000, currency: 'PLN', createdAt: new Date('2026-06-20T00:00:00Z'), updatedAt: new Date('2026-06-20T00:00:00Z') };

describe('getOwnedPaymentStatus', () => {
  it('returns null for non-owner payment lookup', async () => {
    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'other' }, ctxFor({ ...base, status: PaymentStatus.PENDING }));
    expect(result.ok && result.data).toBeNull();
  });

  it.each([
    [PaymentStatus.PENDING, null, 'PENDING_WEBHOOK', false],
    [PaymentStatus.SUCCEEDED, { id: 'grant_1' }, 'SUCCEEDED', true],
    [PaymentStatus.SUCCEEDED, null, 'ACCESS_SYNC_PENDING', false],
    [PaymentStatus.FAILED, null, 'FAILED_CANCELED', false],
    [PaymentStatus.CANCELED, null, 'FAILED_CANCELED', false],
    [PaymentStatus.REFUNDED, null, 'REFUNDED_DISPUTED', false],
    [PaymentStatus.DISPUTED, null, 'REFUNDED_DISPUTED', false],
  ])('maps %s to %s', async (status, grant, uiStatus, accessSynced) => {
    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctxFor({ ...base, status }, grant));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.data?.uiStatus).toBe(uiStatus);
    expect(result.data?.accessSynced).toBe(accessSynced);
  });
});
