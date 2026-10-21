import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
let intentSeq = 0;
const intents = new Map<string, any>();
const byIdempotencyKey = new Map<string, any>();
const stripe = {
  customers: { create: vi.fn(async () => ({ id: 'cus_new' })) },
  paymentIntents: {
    create: vi.fn(async (params: any, options: any = {}) => {
      // Like Stripe: the same idempotency key returns the first result.
      if (options.idempotencyKey && byIdempotencyKey.has(options.idempotencyKey)) return byIdempotencyKey.get(options.idempotencyKey);
      const intent = {
        id: `pi_${++intentSeq}`,
        client_secret: `pi_${intentSeq}_secret`,
        status: 'requires_payment_method',
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        payment_method_types: params.currency === 'pln' ? ['blik', 'card', 'p24'] : ['card'],
      };
      intents.set(intent.id, intent);
      if (options.idempotencyKey) byIdempotencyKey.set(options.idempotencyKey, intent);
      return intent;
    }),
    retrieve: vi.fn(async (id: string) => ({ ...intents.get(id) })),
    update: vi.fn(async (id: string, params: any) => {
      const intent = intents.get(id);
      Object.assign(intent, params, { payment_method_types: params.currency === 'pln' ? ['blik', 'card', 'p24'] : ['card'] });
      return { ...intent };
    }),
  },
};

vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({ getStripeClient: () => stripe }));
vi.mock('@/lib/modules/channel', () => ({ MainChannelService: { getRequired: vi.fn(async () => ({ id: 'creator_1' })) } }));

const { createCheckoutIntent } = await import('@/lib/modules/payments/application/create-checkout-intent.use-case');

const userCtx = () => createTestContext(db, { type: 'user', userId: 'user_1' });
const REQUEST = '7d9b2f1e-2f4c-4f8a-9d61-3c6c1d2b8a10';

beforeEach(() => {
  db.payment.rows.length = 0;
  db.user.rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl', stripeCustomerId: 'cus_1' });
  intents.clear();
  byIdempotencyKey.clear();
  intentSeq = 0;
  vi.clearAllMocks();
});

describe('createCheckoutIntent: patron-zone payments (experiment: premium-pass)', () => {
  it('marks the payment and its intent with the purpose and uses the patron description', async () => {
    const result = await createCheckoutIntent({ userId: 'user_1', amountMinor: 2999, currency: 'PLN', requestId: REQUEST, purpose: 'premium_pass', productId: 'ACCESS_LIFETIME' }, userCtx());
    expect(result.ok).toBe(true);
    expect(db.payment.rows[0].metadata).toEqual({ requestId: REQUEST, purpose: 'premium_pass', productId: 'ACCESS_LIFETIME' });
    const params = stripe.paymentIntents.create.mock.calls[0]![0];
    expect(params.metadata).toMatchObject({ userId: 'user_1', purpose: 'premium_pass', productId: 'ACCESS_LIFETIME', paymentId: db.payment.rows[0].id });
    expect(params.amount).toBe(2999);
    expect(params.description).toMatch(/^Dostęp do strefy patrona/);
  });

  it('a tip leaves no purpose marker', async () => {
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());
    expect(db.payment.rows[0].metadata).toEqual({ requestId: REQUEST });
    expect(stripe.paymentIntents.create.mock.calls[0]![0].metadata).not.toHaveProperty('purpose');
  });

  it('the tip route cannot re-price a patron payment through its request id, and the other way round', async () => {
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1499, currency: 'PLN', requestId: REQUEST, purpose: 'premium_pass', productId: 'ACCESS_30D' }, userCtx());
    const retarget = await createCheckoutIntent({ userId: 'user_1', amountMinor: 200, currency: 'PLN', requestId: REQUEST }, userCtx());
    expect(retarget.ok).toBe(false);
    expect(stripe.paymentIntents.update).not.toHaveBeenCalled();
    expect(db.payment.rows[0].amountMinor).toBe(1499);

    const OTHER = '9a1b2f1e-2f4c-4f8a-9d61-3c6c1d2b8a99';
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: OTHER }, userCtx());
    const wrongWay = await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: OTHER, purpose: 'premium_pass' }, userCtx());
    expect(wrongWay.ok).toBe(false);
  });

  it('the same patron attempt with another product updates amount, intent metadata and the payment row together', async () => {
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 2999, currency: 'PLN', requestId: REQUEST, purpose: 'premium_pass', productId: 'ACCESS_LIFETIME' }, userCtx());
    const again = await createCheckoutIntent({ userId: 'user_1', amountMinor: 1499, currency: 'PLN', requestId: REQUEST, purpose: 'premium_pass', productId: 'ACCESS_30D' }, userCtx());
    expect(again.ok).toBe(true);
    expect(stripe.paymentIntents.update).toHaveBeenCalledTimes(1);
    expect(stripe.paymentIntents.update.mock.calls[0]![1]).toMatchObject({ amount: 1499, metadata: { productId: 'ACCESS_30D' } });
    expect(db.payment.rows).toHaveLength(1);
    expect(db.payment.rows[0].amountMinor).toBe(1499);
    expect(db.payment.rows[0].metadata).toEqual({ requestId: REQUEST, purpose: 'premium_pass', productId: 'ACCESS_30D' });
  });
});

describe('createCheckoutIntent', () => {
  it('refuses guests', async () => {
    const result = await createCheckoutIntent(
      { userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST },
      createTestContext(db, { type: 'guest' }),
    );
    expect(result.ok).toBe(false);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('creates one PENDING payment and one intent with a server-side description (PAY-18)', async () => {
    const result = await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());

    expect(result.ok).toBe(true);
    expect(db.payment.rows).toHaveLength(1);
    expect(db.payment.rows[0]).toMatchObject({ status: 'PENDING', amountMinor: 1000, currency: 'PLN', stripeIntentId: 'pi_1' });
    expect(stripe.paymentIntents.create.mock.calls[0][0].description).toMatch(/^Napiwek dla /);
  });

  it('changing the amount on the same attempt updates the intent instead of creating another (PAY-08)', async () => {
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());
    const second = await createCheckoutIntent({ userId: 'user_1', amountMinor: 2500, currency: 'EUR', requestId: REQUEST }, userCtx());

    expect(second.ok && second.data.clientSecret).toBe('pi_1_secret');
    expect(second.ok && second.data.paymentMethodTypes).toEqual(['card']);
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(intents.get('pi_1')).toMatchObject({ amount: 2500, currency: 'eur' });
    expect(db.payment.rows).toHaveLength(1);
    expect(db.payment.rows[0]).toMatchObject({ amountMinor: 2500, currency: 'EUR', status: 'PENDING' });
  });

  it('the same amount again just returns the existing intent', async () => {
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());

    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(stripe.paymentIntents.update).not.toHaveBeenCalled();
  });

  it('refuses to change the amount while the payer is confirming in the bank app', async () => {
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());
    intents.get('pi_1').status = 'requires_action';

    const result = await createCheckoutIntent({ userId: 'user_1', amountMinor: 2000, currency: 'PLN', requestId: REQUEST }, userCtx());

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('PAYMENT_IN_PROGRESS');
    expect(db.payment.rows[0].amountMinor).toBe(1000);
  });

  it('reports a finished attempt as terminal so the client starts a new one', async () => {
    await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());
    intents.get('pi_1').status = 'canceled';

    const result = await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());

    expect(result.ok && result.data.terminal).toBe(true);
    expect(db.payment.rows[0].status).toBe('CANCELED');
  });

  it('two concurrent requests for one attempt end with one row, not a 500 (PAY-20)', async () => {
    const [a, b] = await Promise.all([
      createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx()),
      createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx()),
    ]);

    expect(a.ok && b.ok).toBe(true);
    expect(db.payment.rows).toHaveLength(1);
    expect(intents.size).toBe(1);
  });

  it('never sends a Stripe error message to the client (PAY-19)', async () => {
    stripe.paymentIntents.create.mockRejectedValueOnce(new Error('Invalid API Key provided: sk_live_****abcd'));

    const result = await createCheckoutIntent({ userId: 'user_1', amountMinor: 1000, currency: 'PLN', requestId: REQUEST }, userCtx());

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).not.toContain('sk_live');
    expect(db.payment.rows[0].status).toBe('FAILED');
  });
});
