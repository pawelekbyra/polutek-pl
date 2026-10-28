// Which Stripe key set a new payment is created with, and that it stays with the payment.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
const clientsBySet: Record<string, ReturnType<typeof makeClient>> = {};
let seq = 0;
function makeClient(set: string) {
  return {
    set,
    customers: { create: vi.fn(async () => ({ id: `cus_${set}` })) },
    paymentIntents: {
      create: vi.fn(async (params: any) => ({ id: `pi_${set}_${++seq}`, client_secret: 's', status: 'requires_payment_method', amount: params.amount, currency: params.currency, payment_method_types: ['card'] })),
      retrieve: vi.fn(async (id: string) => ({ id, client_secret: 's', status: 'requires_payment_method', amount: 1499, currency: 'pln', payment_method_types: ['card'] })),
      update: vi.fn(),
    },
  };
}
const getStripeClient = vi.fn((set: string = 'default') => (clientsBySet[set] ??= makeClient(set)));

vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({ getStripeClient: (set?: string) => getStripeClient(set) }));
vi.mock('@/lib/modules/channel', () => ({ MainChannelService: { getRequired: vi.fn(async () => ({ id: 'creator_1' })) } }));

const { createCheckoutIntent } = await import('@/lib/modules/payments/application/create-checkout-intent.use-case');

const userCtx = () => createTestContext(db, { type: 'user', userId: 'user_1' });
const R1 = '7d9b2f1e-2f4c-4f8a-9d61-3c6c1d2b8a10';
const R2 = '9a1b2f1e-2f4c-4f8a-9d61-3c6c1d2b8a99';
const PREMIUM_ENV = { PREMIUM_PASS_STRIPE_SECRET_KEY: 'sk_test_b', NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: 'pk_test_b', PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: 'whsec_b' };

function setPremiumEnv(on: boolean) {
  for (const [k, v] of Object.entries(PREMIUM_ENV)) {
    if (on) process.env[k] = v;
    else delete process.env[k];
  }
}

beforeEach(() => {
  db.payment.rows.length = 0;
  db.user.rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl', stripeCustomerId: 'cus_live_1' });
  for (const k of Object.keys(clientsBySet)) delete clientsBySet[k];
  vi.clearAllMocks();
  setPremiumEnv(false);
});
afterEach(() => setPremiumEnv(false));

const patron = (requestId: string): any => ({ userId: 'user_1', amountMinor: 1499, currency: 'PLN', requestId, purpose: 'premium_pass', productId: 'ACCESS_30D' });

describe('key set of a new payment', () => {
  it('without the premium variables the patron checkout uses the default keys and writes no marker (as before)', async () => {
    await createCheckoutIntent(patron(R1), userCtx());
    expect(getStripeClient.mock.calls.every(([set]) => set === 'default')).toBe(true);
    expect(db.payment.rows[0].metadata).toEqual({ requestId: R1, purpose: 'premium_pass', productId: 'ACCESS_30D' });
    expect(clientsBySet.premium).toBeUndefined();
  });

  it('with the premium variables the patron checkout uses the premium client, marks the payment and sends no live customer', async () => {
    setPremiumEnv(true);
    await createCheckoutIntent(patron(R1), userCtx());
    expect(clientsBySet.default).toBeUndefined();
    expect(clientsBySet.premium!.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(clientsBySet.premium!.paymentIntents.create.mock.calls[0]![0].customer).toBeUndefined();
    expect(clientsBySet.premium!.customers.create).not.toHaveBeenCalled();
    expect(db.payment.rows[0].metadata).toMatchObject({ purpose: 'premium_pass', stripeKeySet: 'premium' });
    expect(db.user.rows[0].stripeCustomerId).toBe('cus_live_1');
  });

  it('tips keep the default keys and the live customer even when the premium set is configured', async () => {
    setPremiumEnv(true);
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: R2 }, userCtx());
    expect(clientsBySet.premium).toBeUndefined();
    expect(clientsBySet.default!.paymentIntents.create.mock.calls[0]![0].customer).toBe('cus_live_1');
    expect(db.payment.rows[0].metadata).toEqual({ requestId: R2 });
  });

  it('a retried premium attempt keeps using the premium client', async () => {
    setPremiumEnv(true);
    await createCheckoutIntent(patron(R1), userCtx());
    const again = await createCheckoutIntent(patron(R1), userCtx());
    expect(again.ok).toBe(true);
    expect(clientsBySet.default).toBeUndefined();
    expect(clientsBySet.premium!.paymentIntents.retrieve).toHaveBeenCalledTimes(1);
  });

  it('an unpaid attempt made with the default set is not reused once the premium set is on', async () => {
    await createCheckoutIntent(patron(R1), userCtx());
    setPremiumEnv(true);
    const again = await createCheckoutIntent(patron(R1), userCtx());
    expect(again.ok).toBe(false);
    expect(db.payment.rows).toHaveLength(1);
  });
});
