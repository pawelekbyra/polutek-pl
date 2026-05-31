import { describe, expect, it } from 'vitest';
import { PaymentStatus } from '@prisma/client';
import { calculateChargebackAdjustment, calculateRefundAdjustment } from '@/lib/services/payment.service';

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

  it('calculates remaining net amount for chargeback after a partial refund', () => {
    const result = calculateChargebackAdjustment({ amountMinor: 2000, refundedAmountMinor: 500 });
    expect(result.refundedAmountMinor).toBe(500);
    expect(result.remainingNetMinor).toBe(1500);
  });
});
