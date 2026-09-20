import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminDisputeSync } from '@/lib/modules/payments/application/admin-dispute-sync.use-case';
import { handleDispute } from '@/lib/modules/payments/application/handle-dispute.use-case';
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

vi.mock('@/lib/modules/payments/application/handle-dispute.use-case', () => ({
  handleDispute: vi.fn(),
}));

vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: vi.fn(),
}));

describe('adminDisputeSync', () => {
  let ctx: AppContext;
  const chargesList = vi.fn();
  const disputesList = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (getStripeClient as any).mockReturnValue({
      charges: { list: chargesList },
      disputes: { list: disputesList },
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

  it('fails with PAYMENT_NOT_FOUND (404) when the payment does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await adminDisputeSync({ paymentId: 'missing' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_NOT_FOUND');
      expect(result.error.statusCode).toBe(404);
    }
  });

  it('fails with PAYMENT_NO_STRIPE_INTENT (422) when the payment has no Stripe intent id', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment({ stripeIntentId: null }));

    const result = await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_NO_STRIPE_INTENT');
      expect(result.error.statusCode).toBe(422);
    }
  });

  it('returns synced: false when no charges exist for the payment intent', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    chargesList.mockResolvedValue({ data: [] });

    const result = await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        disputeId: null,
        disputeStatus: null,
        synced: false,
        message: 'No charges found for this payment intent',
      });
    }
    expect(disputesList).not.toHaveBeenCalled();
    expect(handleDispute).not.toHaveBeenCalled();
  });

  it('returns synced: false when the charge has no dispute', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    chargesList.mockResolvedValue({ data: [{ id: 'ch_1' }] });
    disputesList.mockResolvedValue({ data: [] });

    const result = await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.synced).toBe(false);
      expect(result.data.message).toBe('No dispute found for this payment');
    }
    expect(handleDispute).not.toHaveBeenCalled();
  });

  it('syncs a lost dispute, mapping status and flags correctly', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    chargesList.mockResolvedValue({ data: [{ id: 'ch_1' }] });
    disputesList.mockResolvedValue({ data: [{ id: 'dp_1', status: 'lost' }] });
    (handleDispute as any).mockResolvedValue({ ok: true, data: {} });

    const result = await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        disputeId: 'dp_1',
        disputeStatus: 'lost',
        synced: true,
        message: 'Dispute dp_1 synced (status: lost)',
      });
    }
    expect(handleDispute).toHaveBeenCalledWith(
      {
        stripeIntentId: 'pi_123',
        disputeId: 'dp_1',
        status: 'chargeback_lost',
        isLost: true,
        isWon: false,
      },
      ctx,
    );
  });

  it('syncs a won dispute, mapping status and flags correctly', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    chargesList.mockResolvedValue({ data: [{ id: 'ch_1' }] });
    disputesList.mockResolvedValue({ data: [{ id: 'dp_2', status: 'won' }] });
    (handleDispute as any).mockResolvedValue({ ok: true, data: {} });

    await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(handleDispute).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'chargeback_won', isLost: false, isWon: true }),
      ctx,
    );
  });

  it('maps an unrecognized Stripe dispute status through unchanged, with both flags false', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    chargesList.mockResolvedValue({ data: [{ id: 'ch_1' }] });
    disputesList.mockResolvedValue({ data: [{ id: 'dp_3', status: 'needs_response' }] });
    (handleDispute as any).mockResolvedValue({ ok: true, data: {} });

    await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(handleDispute).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'needs_response', isLost: false, isWon: false }),
      ctx,
    );
  });

  it('wraps a Stripe API failure in a PaymentProviderError (502)', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    chargesList.mockRejectedValue(new Error('rate_limited'));

    const result = await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_PROVIDER_ERROR');
      expect(result.error.statusCode).toBe(502);
      expect(result.error.message).toContain('rate_limited');
    }
    expect(handleDispute).not.toHaveBeenCalled();
  });

  it('propagates the handleDispute error when the DB sync fails', async () => {
    mockRepo.findById.mockResolvedValue(mockPayment());
    chargesList.mockResolvedValue({ data: [{ id: 'ch_1' }] });
    disputesList.mockResolvedValue({ data: [{ id: 'dp_4', status: 'lost' }] });
    const dbError = { code: 'DATABASE_ERROR', message: 'db down', statusCode: 500 };
    (handleDispute as any).mockResolvedValue({ ok: false, error: dbError });

    const result = await adminDisputeSync({ paymentId: 'pay_1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(dbError);
    }
  });
});
