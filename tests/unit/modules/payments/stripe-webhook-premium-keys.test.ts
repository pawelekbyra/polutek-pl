/**
 * One webhook URL, two Stripe endpoints: the live one (tips, STRIPE_WEBHOOK_SECRET) and the test-mode one of the
 * patron-zone checkout (PREMIUM_PASS_STRIPE_WEBHOOK_SECRET). Real signatures (Stripe's own test helper), real
 * `constructEvent`; only the database, e-mail, audit and the Stripe API client are replaced.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { createFakePaymentsDb } from './fake-payments-db';

const LIVE_SECRET = 'whsec_live_signing_secret_for_unit_tests';
const TEST_SECRET = 'whsec_test_signing_secret_for_unit_tests';
const db = createFakePaymentsDb();
const disputesRetrieve = vi.fn();
const clientSets: string[] = [];

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/lib/modules/email', () => ({ sendBecomePatronEmail: vi.fn(), sendDonationThankYouEmail: vi.fn() }));
vi.mock('@/lib/modules/notifications', () => ({
  sendNotification: vi.fn(),
  notificationTemplates: { supportThanks: { kind: 'PATRON', titlePl: 't', titleEn: 't', bodyPl: 'b', bodyEn: 'b' } },
}));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: (set: string = 'default') => {
    clientSets.push(set);
    return { disputes: { retrieve: disputesRetrieve }, refunds: { list: vi.fn(async () => ({ data: [], has_more: false })) } };
  },
}));

const { POST } = await import('@/app/api/webhooks/stripe/route');

const ENV_NAMES = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'PREMIUM_PASS_STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY',
  'PREMIUM_PASS_STRIPE_WEBHOOK_SECRET',
];

/** Production as it will be with the trial on: live keys for the tips, test keys for the patron-zone checkout. */
function bothSets() {
  process.env.STRIPE_SECRET_KEY = 'sk_live_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = LIVE_SECRET;
  process.env.PREMIUM_PASS_STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY = 'pk_test_dummy';
  process.env.PREMIUM_PASS_STRIPE_WEBHOOK_SECRET = TEST_SECRET;
}

let eventSeq = 0;
function signed(type: string, object: Record<string, unknown>, options: { livemode: boolean; secret: string }) {
  const payload = JSON.stringify({
    id: `evt_${++eventSeq}`,
    object: 'event',
    type,
    livemode: options.livemode,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: options.secret });
  return new NextRequest('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': header }, body: payload });
}

const succeeded = (payment: { id: string; stripeIntentId: string }) => ({
  id: payment.stripeIntentId,
  object: 'payment_intent',
  amount: 1000,
  currency: 'pln',
  status: 'succeeded',
  metadata: { paymentId: payment.id, userId: 'user_1' },
});

function seedPayment(metadata: Record<string, unknown> = {}) {
  const n = db.payment.rows.length + 1;
  const row = {
    id: `pay_${n}`,
    userId: 'user_1',
    creatorId: 'creator_1',
    amountMinor: 1000,
    currency: 'PLN',
    status: 'PENDING',
    stripeIntentId: `pi_${n}`,
    refundedAmountMinor: 0,
    requestId: null,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.payment.rows.push(row);
  return row;
}

beforeEach(() => {
  for (const name of ['payment', 'stripeEvent', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl' });
  vi.clearAllMocks();
  clientSets.length = 0;
  for (const name of ENV_NAMES) delete process.env[name];
});

describe('webhook with two signing secrets', () => {
  it('a tip is recorded by an event signed with the live secret', async () => {
    bothSets();
    const tip = seedPayment();
    const response = await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: true, secret: LIVE_SECRET }));
    expect(response.status).toBe(200);
    expect(tip.status).toBe('SUCCEEDED');
  });

  it('a premium (test-mode) payment is recorded by an event signed with the premium secret', async () => {
    bothSets();
    const premium = seedPayment({ stripeKeySet: 'premium' });
    const response = await POST(signed('payment_intent.succeeded', succeeded(premium), { livemode: false, secret: TEST_SECRET }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ outcome: 'processed' });
    expect(premium.status).toBe('SUCCEEDED');
  });

  it('a payload signed with neither secret is rejected and stores nothing', async () => {
    bothSets();
    const tip = seedPayment();
    const response = await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: true, secret: 'whsec_somebody_else' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'PAYMENT_WEBHOOK_SIGNATURE_ERROR' });
    expect(db.stripeEvent.rows).toHaveLength(0);
    expect(tip.status).toBe('PENDING');
  });

  it('a body changed after signing is rejected with either secret', async () => {
    bothSets();
    const premium = seedPayment({ stripeKeySet: 'premium' });
    const original = signed('payment_intent.succeeded', succeeded(premium), { livemode: false, secret: TEST_SECRET });
    const tampered = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': original.headers.get('stripe-signature')! },
      body: (await original.text()).replace('"amount":1000', '"amount":1'),
    });
    expect((await POST(tampered)).status).toBe(400);
    expect(premium.status).toBe('PENDING');
  });

  it('a test-mode event can never complete a tip, even when signed with the premium secret', async () => {
    bothSets();
    const tip = seedPayment();
    const response = await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: false, secret: TEST_SECRET }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ outcome: 'ignored' });
    expect(tip.status).toBe('PENDING');
  });

  it('an event signed with the live secret can never complete a premium payment', async () => {
    bothSets();
    const premium = seedPayment({ stripeKeySet: 'premium' });
    const response = await POST(signed('payment_intent.succeeded', succeeded(premium), { livemode: true, secret: LIVE_SECRET }));
    await expect(response.json()).resolves.toMatchObject({ outcome: 'ignored' });
    expect(premium.status).toBe('PENDING');
  });

  it('a live-mode event signed with the premium secret is ignored (mode of the premium key is test)', async () => {
    bothSets();
    const premium = seedPayment({ stripeKeySet: 'premium' });
    const response = await POST(signed('payment_intent.succeeded', succeeded(premium), { livemode: true, secret: TEST_SECRET }));
    await expect(response.json()).resolves.toMatchObject({ outcome: 'ignored' });
    expect(premium.status).toBe('PENDING');
  });

  it('a test-mode event signed with the live secret is ignored (mode of the default key is live)', async () => {
    bothSets();
    const tip = seedPayment();
    const response = await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: false, secret: LIVE_SECRET }));
    await expect(response.json()).resolves.toMatchObject({ outcome: 'ignored' });
    expect(tip.status).toBe('PENDING');
  });

  it('a missing live secret does not break the premium endpoint, and the live endpoint is then rejected', async () => {
    bothSets();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const premium = seedPayment({ stripeKeySet: 'premium' });
    expect((await POST(signed('payment_intent.succeeded', succeeded(premium), { livemode: false, secret: TEST_SECRET }))).status).toBe(200);
    expect(premium.status).toBe('SUCCEEDED');
    const tip = seedPayment();
    expect((await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: true, secret: LIVE_SECRET }))).status).toBe(400);
    expect(tip.status).toBe('PENDING');
  });

  it('a missing premium variable does not break the live endpoint, and the premium secret is not accepted', async () => {
    bothSets();
    delete process.env.NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY;
    const tip = seedPayment();
    expect((await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: true, secret: LIVE_SECRET }))).status).toBe(200);
    expect(tip.status).toBe('SUCCEEDED');
    const premium = seedPayment({ stripeKeySet: 'premium' });
    expect((await POST(signed('payment_intent.succeeded', succeeded(premium), { livemode: false, secret: TEST_SECRET }))).status).toBe(400);
    expect(premium.status).toBe('PENDING');
  });

  it('without any secret the route answers 500 (Stripe retries), as before', async () => {
    const tip = seedPayment();
    expect((await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: true, secret: LIVE_SECRET }))).status).toBe(500);
  });

  it('is unchanged without the premium variables: only STRIPE_WEBHOOK_SECRET is accepted', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = LIVE_SECRET;
    const tip = seedPayment();
    expect((await POST(signed('payment_intent.succeeded', succeeded(tip), { livemode: false, secret: LIVE_SECRET }))).status).toBe(200);
    expect(tip.status).toBe('SUCCEEDED');
  });

  it('disputes of a premium payment are read with the premium client; tips with the default one', async () => {
    bothSets();
    const premium = seedPayment({ stripeKeySet: 'premium' });
    premium.status = 'SUCCEEDED';
    disputesRetrieve.mockResolvedValue({ id: 'dp_1', status: 'needs_response' });
    await POST(signed('charge.dispute.created', { id: 'dp_1', object: 'dispute', payment_intent: premium.stripeIntentId, status: 'needs_response' }, { livemode: false, secret: TEST_SECRET }));
    expect(clientSets).toContain('premium');
    expect(clientSets).not.toContain('default');

    clientSets.length = 0;
    const tip = seedPayment();
    tip.status = 'SUCCEEDED';
    await POST(signed('charge.dispute.created', { id: 'dp_2', object: 'dispute', payment_intent: tip.stripeIntentId, status: 'needs_response' }, { livemode: true, secret: LIVE_SECRET }));
    expect(clientSets).toContain('default');
    expect(clientSets).not.toContain('premium');
  });

  it('a dispute event for a premium payment signed with the live secret never reaches Stripe', async () => {
    bothSets();
    const premium = seedPayment({ stripeKeySet: 'premium' });
    premium.status = 'SUCCEEDED';
    const response = await POST(signed('charge.dispute.created', { id: 'dp_3', object: 'dispute', payment_intent: premium.stripeIntentId, status: 'needs_response' }, { livemode: true, secret: LIVE_SECRET }));
    await expect(response.json()).resolves.toMatchObject({ outcome: 'ignored' });
    expect(disputesRetrieve).not.toHaveBeenCalled();
    expect(premium.status).toBe('SUCCEEDED');
  });
});
