import { describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@prisma/client';
import { applyLostChargeback, calculateChargebackNetAdjustment, calculateRefundAdjustment } from '@/lib/services/payment.service';

describe('refund amount adjustments', () => {
  it('calculates the first partial refund delta without revoking patron access', () => {
    const result = calculateRefundAdjustment({ amountMinor: 2000, refundedAmountMinor: 0 }, 500);
    expect(result).toMatchObject({
      previousRefunded: 0,
      newRefundedAmountMinor: 500,
      deltaRefundMinor: 500,
      isFullRefund: false,
      status: PaymentStatus.PARTIALLY_REFUNDED,
    });
  });

  it('is idempotent for a repeated refund event', () => {
    const result = calculateRefundAdjustment({ amountMinor: 2000, refundedAmountMinor: 500 }, 500);
    expect(result.deltaRefundMinor).toBe(0);
    expect(result.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
  });

  it('only subtracts the remaining delta for a full refund after a partial refund', () => {
    const result = calculateRefundAdjustment({ amountMinor: 2000, refundedAmountMinor: 500 }, 2000);
    expect(result.deltaRefundMinor).toBe(1500);
    expect(result.isFullRefund).toBe(true);
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });

  it('caps refunds at the payment amount so totals cannot go below zero', () => {
    const result = calculateRefundAdjustment({ amountMinor: 2000, refundedAmountMinor: 0 }, 9999);
    expect(result.newRefundedAmountMinor).toBe(2000);
    expect(result.deltaRefundMinor).toBe(2000);
  });
});


describe('lost chargeback adjustments', () => {
  it('updates status, revokes grant, and subtracts only remaining net amount', async () => {
    const tx = {
      payment: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      patronGrant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: {
        findUnique: vi.fn().mockResolvedValue({ totalPaidMinor: 2000 }),
        update: vi.fn().mockResolvedValue({}),
      },
      userPaymentTotal: {
        findUnique: vi.fn().mockResolvedValue({ amountMinor: 2000 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    await applyLostChargeback(tx as never, {
      id: 'payment_1',
      userId: 'user_1',
      currency: 'PLN',
      amountMinor: 2000,
      refundedAmountMinor: 500,
      status: PaymentStatus.SUCCEEDED
    }, 'lost');

    expect(calculateChargebackNetAdjustment({ amountMinor: 2000, refundedAmountMinor: 500 })).toBe(1500);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment_1',
        status: { not: PaymentStatus.CHARGEBACK_LOST }
      },
      data: { status: PaymentStatus.CHARGEBACK_LOST },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { totalPaidMinor: 500 },
    });
    expect(tx.userPaymentTotal.update).toHaveBeenCalledWith({
      where: { userId_currency: { userId: 'user_1', currency: 'PLN' } },
      data: { amountMinor: 500 },
    });
    expect(tx.patronGrant.updateMany).toHaveBeenCalledWith({
      where: { paymentId: 'payment_1', revokedAt: null },
      data: expect.objectContaining({ reason: 'Payment disputed: lost' }),
    });
  });
});
