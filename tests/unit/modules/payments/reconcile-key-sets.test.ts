// Reconciliation, the payment-status fast path and refund sync ask Stripe with the key set the payment was made with.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
const retrieveBySet: Record<string, ReturnType<typeof vi.fn>> = {};
const getStripeClient = vi.fn((set: string = 'default') => {
  retrieveBySet[set] ??= vi.fn(async (id: string) => ({ id, status: 'requires_payment_method', amount: 1000, currency: 'pln', metadata: {} }));
  return { paymentIntents: { retrieve: retrieveBySet[set], cancel: vi.fn() }, refunds: { list: vi.fn(async () => ({ data: [], has_more: false })) } };
});

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({ getStripeClient: (set?: string) => getStripeClient(set) }));

const { reconcilePaymentWithStripe } = await import('@/lib/modules/payments/application/reconcile-payment.use-case');
const { syncRefundsFromStripe } = await import('@/lib/modules/payments/application/sync-refunds.use-case');

const ctx = () => createTestContext(db, { type: 'system', reason: 'test' });
const DAY = 24 * 60 * 60 * 1000;
const PREMIUM_ENV = { PREMIUM_PASS_STRIPE_SECRET_KEY: 'sk_test_b', NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: 'pk_test_b', PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: 'whsec_b' };

function setPremiumEnv(on: boolean) {
  for (const [k, v] of Object.entries(PREMIUM_ENV)) {
    if (on) process.env[k] = v;
    else delete process.env[k];
  }
}

function seed(metadata: Record<string, unknown>, createdAt = new Date(Date.now() - 20 * 60_000), status = 'PENDING'): any {
  const row = {
    id: `pay_${db.payment.rows.length + 1}`,
    userId: 'user_1',
    creatorId: 'creator_1',
    amountMinor: 1000,
    refundedAmountMinor: 0,
    currency: 'PLN',
    status,
    stripeIntentId: `pi_${db.payment.rows.length + 1}`,
    metadata,
    createdAt,
    updatedAt: new Date(),
  };
  db.payment.rows.push(row);
  return row;
}

beforeEach(() => {
  db.payment.rows.length = 0;
  for (const k of Object.keys(retrieveBySet)) delete retrieveBySet[k];
  vi.clearAllMocks();
  setPremiumEnv(false);
});
afterEach(() => setPremiumEnv(false));

describe('reconcilePaymentWithStripe picks the key set of the payment', () => {
  it('a premium payment is read with the premium client, a tip with the default one', async () => {
    setPremiumEnv(true);
    await reconcilePaymentWithStripe(seed({ stripeKeySet: 'premium' }), ctx());
    await reconcilePaymentWithStripe(seed({}), ctx());
    expect(retrieveBySet.premium).toHaveBeenCalledTimes(1);
    expect(retrieveBySet.default).toHaveBeenCalledTimes(1);
    expect(retrieveBySet.premium!.mock.calls[0]![0]).toBe('pi_1');
    expect(retrieveBySet.default!.mock.calls[0]![0]).toBe('pi_2');
  });

  it('a payment row without metadata (older rows) is a default-set payment', async () => {
    await reconcilePaymentWithStripe({ ...seed({}), metadata: undefined }, ctx());
    expect(retrieveBySet.default).toHaveBeenCalledTimes(1);
  });

  it('premium payment while the premium set is not configured: never asked with the live key; fresh row untouched', async () => {
    const row = seed({ stripeKeySet: 'premium' });
    expect(await reconcilePaymentWithStripe(row, ctx())).toBe('unchanged');
    expect(getStripeClient).not.toHaveBeenCalled();
    expect(row.status).toBe('PENDING');
  });

  it('premium payment while the premium set is not configured: an abandoned row is closed locally so it cannot starve the batch', async () => {
    const row = seed({ stripeKeySet: 'premium' }, new Date(Date.now() - 2 * DAY));
    expect(await reconcilePaymentWithStripe(row, ctx())).toBe('canceled');
    expect(getStripeClient).not.toHaveBeenCalled();
    expect(row.status).toBe('CANCELED');
  });
});

describe('syncRefundsFromStripe picks the key set of the payment', () => {
  it('uses the premium client for a premium payment and skips it (marking it checked) when the premium set is gone', async () => {
    const row = seed({ stripeKeySet: 'premium' }, undefined, 'SUCCEEDED');
    (row as any).refundsCheckedAt = null;

    const skipped = await syncRefundsFromStripe({ paymentId: row.id }, ctx());
    expect(skipped.ok).toBe(true);
    expect(getStripeClient).not.toHaveBeenCalled();
    expect((row as any).refundsCheckedAt).toBeInstanceOf(Date);

    setPremiumEnv(true);
    const synced = await syncRefundsFromStripe({ paymentId: row.id }, ctx());
    expect(synced.ok).toBe(true);
    expect(getStripeClient).toHaveBeenCalledWith('premium');
    expect(getStripeClient).not.toHaveBeenCalledWith('default');
  });
});
