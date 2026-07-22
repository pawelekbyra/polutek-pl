import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PaymentStatus } from '@prisma/client';
import { getOwnedPaymentStatus } from '@/lib/modules/payments/application/get-payment-status.use-case';
import * as fulfillModule from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { ok } from '@/lib/modules/shared/result';

const mockRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function (this: any) {
    return { paymentIntents: { retrieve: mockRetrieve } };
  }),
}));

function ctxFor(payment: any, grant: any = null): any {
  // Mutable "DB" so a reconciliation-triggered write (via fulfillPayment) can be observed on
  // the re-read that getOwnedPaymentStatus performs after attempting reconciliation.
  let current = payment;
  return {
    db: {
      read: {
        payment: { findFirst: async ({ where }: any) => current && current.id === where.id && current.userId === where.userId ? current : null },
        patronGrant: { findFirst: async () => grant },
      },
    },
    __setPayment: (next: any) => { current = next; },
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

describe('getOwnedPaymentStatus - Stripe reconciliation fast-path', () => {
  const pendingWithIntent = { ...base, status: PaymentStatus.PENDING, stripeIntentId: 'pi_123' };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  it('fulfills via the canonical fulfillPayment() when Stripe reports the intent succeeded', async () => {
    const ctx = ctxFor(pendingWithIntent, { id: 'grant_1' });
    mockRetrieve.mockResolvedValue({ id: 'pi_123', status: 'succeeded', amount: 1000, currency: 'pln', metadata: {} });
    const fulfillSpy = vi.spyOn(fulfillModule, 'fulfillPayment').mockImplementation(async () => {
      // Simulate fulfillPayment's real effect: the local Payment row flips to SUCCEEDED.
      ctx.__setPayment({ ...pendingWithIntent, status: PaymentStatus.SUCCEEDED });
      return ok({ isFirstFulfillment: true });
    });

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx);

    // The reconciliation call must run as a `system` actor, not the paying user's own ctx —
    // grantPatron() inside fulfillPayment is gated to admin/system (PatronPolicy.canGrantPatron),
    // so passing the user ctx through verbatim makes every fast-path fulfillment throw
    // PATRON_GRANT_FAILED and roll back the SUCCEEDED write (the bug this test now guards against).
    expect(fulfillSpy).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_1', stripeIntentId: 'pi_123', amountMinor: 1000, currency: 'pln' }),
      expect.objectContaining({ ...ctx, actor: { type: 'system', reason: 'payment-status-fast-path-reconciliation' } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.data?.uiStatus).toBe('SUCCEEDED');
    expect(result.data?.accessSynced).toBe(true);
  });

  it('does not fulfill when Stripe reports a non-succeeded intent status', async () => {
    const ctx = ctxFor(pendingWithIntent, null);
    mockRetrieve.mockResolvedValue({ id: 'pi_123', status: 'requires_action', amount: 1000, currency: 'pln' });
    const fulfillSpy = vi.spyOn(fulfillModule, 'fulfillPayment');

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx);

    expect(fulfillSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.data?.uiStatus).toBe('PENDING_WEBHOOK');
  });

  it('skips Stripe reconciliation entirely when the local payment has no stripeIntentId', async () => {
    const ctx = ctxFor({ ...base, status: PaymentStatus.PENDING, stripeIntentId: null }, null);

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx);

    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.data?.uiStatus).toBe('PENDING_WEBHOOK');
  });

  it('falls back to PENDING_WEBHOOK without throwing if the Stripe API call fails', async () => {
    const ctx = ctxFor(pendingWithIntent, null);
    mockRetrieve.mockRejectedValue(new Error('Stripe API down'));

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.data?.uiStatus).toBe('PENDING_WEBHOOK');
  });

  it('skips reconciliation entirely when STRIPE_SECRET_KEY is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const ctx = ctxFor(pendingWithIntent, null);

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx);

    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.data?.uiStatus).toBe('PENDING_WEBHOOK');
  });

  it('never reaches Stripe for a payment owned by a different user (ownership check happens first)', async () => {
    const ctx = ctxFor(pendingWithIntent, null);

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'someone_else' }, ctx);

    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(result.ok && result.data).toBeNull();
  });
});
