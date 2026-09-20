import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRefund } from '@/lib/modules/payments/application/admin-refund.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { getStripeClient } from '@/lib/modules/payments/infrastructure/stripe-client';
import { AppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PaymentStatus } from '@prisma/client';

const mockRepo = {
  findById: vi.fn(),
};

vi.mock('@/lib/modules/payments/infrastructure/payment.repository', () => ({
  PaymentRepository: vi.fn().mockImplementation(function () {
    return mockRepo;
  }),
}));

vi.mock('@/lib/modules/payments/application/handle-refund.use-case', () => ({
  handleRefund: vi.fn(),
}));

vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: vi.fn(),
}));

describe('adminRefund', () => {
  let ctx: AppContext;
  const stripeRefundsCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (getStripeClient as any).mockReturnValue({
      refunds: { create: stripeRefundsCreate },
    });

    ctx = {
      actor: { type: 'admin', userId: 'admin_1' } as Actor,
      db: { read: {} as any },
      prisma: {} as any,
      now: () => new Date(),
    } as unknown as AppContext;
  });

  function mockPayment(overrides: Record<string, unknown> = {}) {
    return {
      id: 'pay_1',
      userId: 'user_1',
      amountMinor: 1000,
      refundedAmountMinor: 0,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
      stripeIntentId: 'pi_123',
      ...overrides,
    };
  }

  it('creates a full Stripe refund and applies it via handleRefund when no amount is given', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    stripeRefundsCreate.mockResolvedValue({ id: 're_1', status: 'succeeded' });
    (handleRefund as any).mockResolvedValue({ ok: true, data: {} });

    const result = await adminRefund({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ stripeRefundId: 're_1', amountMinor: 1000, status: 'succeeded' });
    }
    expect(stripeRefundsCreate).toHaveBeenCalledWith({ payment_intent: 'pi_123', amount: 1000 });
    expect(handleRefund).toHaveBeenCalledWith({ paymentId: 'pay_1', reportedRefundedMinor: 1000 }, ctx);
  });

  it('creates a partial refund for the requested amount, adding the total to already-refunded', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment({ refundedAmountMinor: 200 }));
    stripeRefundsCreate.mockResolvedValue({ id: 're_2', status: 'succeeded' });
    (handleRefund as any).mockResolvedValue({ ok: true, data: {} });

    const result = await adminRefund({ paymentId: 'pay_1', amountMinor: 300, reason: 'duplicate' }, ctx);

    expect(result.ok).toBe(true);
    expect(stripeRefundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_123',
      amount: 300,
      reason: 'requested_by_customer',
    });
    expect(handleRefund).toHaveBeenCalledWith({ paymentId: 'pay_1', reportedRefundedMinor: 500 }, ctx);
  });

  it('fails with PAYMENT_NOT_FOUND (404) when the payment does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await adminRefund({ paymentId: 'missing' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_NOT_FOUND');
      expect(result.error.statusCode).toBe(404);
    }
    expect(stripeRefundsCreate).not.toHaveBeenCalled();
  });

  it('fails with PAYMENT_NOT_REFUNDABLE (422) for a status outside the refundable set', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment({ status: PaymentStatus.PENDING }));

    const result = await adminRefund({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_NOT_REFUNDABLE');
      expect(result.error.statusCode).toBe(422);
    }
  });

  it('fails with PAYMENT_NO_STRIPE_INTENT (422) when the payment has no Stripe intent id', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment({ stripeIntentId: null }));

    const result = await adminRefund({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_NO_STRIPE_INTENT');
      expect(result.error.statusCode).toBe(422);
    }
  });

  it('fails with PAYMENT_ALREADY_REFUNDED (422) once the full amount is already refunded', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment({ refundedAmountMinor: 1000 }));

    const result = await adminRefund({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_ALREADY_REFUNDED');
    }
    expect(stripeRefundsCreate).not.toHaveBeenCalled();
  });

  it('fails with INVALID_REFUND_AMOUNT (422) when the requested amount exceeds what remains refundable', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment({ refundedAmountMinor: 800 }));

    const result = await adminRefund({ paymentId: 'pay_1', amountMinor: 500 }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_REFUND_AMOUNT');
    }
    expect(stripeRefundsCreate).not.toHaveBeenCalled();
  });

  it('fails with INVALID_REFUND_AMOUNT (422) for a zero or negative requested amount', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());

    const result = await adminRefund({ paymentId: 'pay_1', amountMinor: 0 }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_REFUND_AMOUNT');
    }
  });

  it('wraps a Stripe API failure in a PaymentProviderError (502) without touching the DB', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    stripeRefundsCreate.mockRejectedValue(new Error('card_declined'));

    const result = await adminRefund({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_PROVIDER_ERROR');
      expect(result.error.statusCode).toBe(502);
      expect(result.error.message).toContain('card_declined');
    }
    expect(handleRefund).not.toHaveBeenCalled();
  });

  it('propagates the handleRefund error when the Stripe refund succeeded but the DB update failed', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    stripeRefundsCreate.mockResolvedValue({ id: 're_3', status: 'succeeded' });
    const dbError = { code: 'DATABASE_ERROR', message: 'db down', statusCode: 500 };
    (handleRefund as any).mockResolvedValue({ ok: false, error: dbError });

    const result = await adminRefund({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(dbError);
    }
  });
});
