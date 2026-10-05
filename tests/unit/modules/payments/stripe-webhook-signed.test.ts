/**
 * The Stripe webhook end to end, with payloads signed by Stripe's own test helper
 * (`stripe.webhooks.generateTestHeaderString`) and verified by the real `constructEvent`. Only the
 * database (in-memory fake), e-mail, notifications, audit and the Stripe API client are replaced.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { createFakePaymentsDb } from './fake-payments-db';

const SECRET = 'whsec_test_signing_secret_for_unit_tests';
const db = createFakePaymentsDb();
const disputesRetrieve = vi.fn();
/** Stripe's refund list per PaymentIntent (what the webhook reads as the truth). */
const stripeRefunds = new Map<string, Array<{ id: string; amount: number; status: string }>>();
const refundsList = vi.fn(async ({ payment_intent }: { payment_intent: string }) => ({ data: stripeRefunds.get(payment_intent) ?? [], has_more: false }));
const sendBecomePatronEmail = vi.fn();
const sendDonationThankYouEmail = vi.fn();
const sendNotification = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/lib/modules/email', () => ({
  sendBecomePatronEmail: (...args: unknown[]) => sendBecomePatronEmail(...args),
  sendDonationThankYouEmail: (...args: unknown[]) => sendDonationThankYouEmail(...args),
}));
vi.mock('@/lib/modules/notifications', () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
  notificationTemplates: {
    supportThanks: { kind: 'PATRON', titlePl: 't', titleEn: 't', bodyPl: 'b', bodyEn: 'b' },
  },
}));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: () => ({ disputes: { retrieve: disputesRetrieve }, refunds: { list: refundsList } }),
}));

const { POST } = await import('@/app/api/webhooks/stripe/route');

let eventSeq = 0;
function signedRequest(type: string, object: Record<string, unknown>, options: { livemode?: boolean; secret?: string; id?: string } = {}) {
  const payload = JSON.stringify({
    id: options.id ?? `evt_test_${++eventSeq}`,
    object: 'event',
    type,
    livemode: options.livemode ?? false,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: options.secret ?? SECRET });
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  });
}

function intent(id: string, paymentId: string | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    object: 'payment_intent',
    amount: 1000,
    currency: 'pln',
    status: 'succeeded',
    metadata: paymentId ? { paymentId, userId: 'user_1' } : {},
    ...extra,
  };
}

function seedPayment(overrides: Record<string, unknown> = {}) {
  const row = {
    id: `pay_${db.payment.rows.length + 1}`,
    userId: 'user_1',
    creatorId: 'creator_1',
    amountMinor: 1000,
    currency: 'PLN',
    status: 'PENDING',
    stripeIntentId: `pi_${db.payment.rows.length + 1}`,
    refundedAmountMinor: 0,
    requestId: null,
    metadata: {},
    createdAt: new Date(Date.now() - db.payment.rows.length * 1000),
    updatedAt: new Date(),
    ...overrides,
  };
  db.payment.rows.push(row);
  return row;
}

function activeGrants() {
  return db.patronGrant.rows.filter((grant: any) => grant.revokedAt == null);
}

beforeEach(() => {
  for (const name of ['payment', 'stripeEvent', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl' });
  vi.clearAllMocks();
  stripeRefunds.clear();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
});

describe('Stripe webhook with real signatures', () => {
  it('records a tip that succeeds after a failed attempt on the same intent (PAY-01)', async () => {
    const payment = seedPayment();

    const failed = await POST(signedRequest('payment_intent.payment_failed', intent(payment.stripeIntentId, payment.id, {
      status: 'requires_payment_method',
      last_payment_error: { code: 'card_declined' },
    })));
    expect(failed.status).toBe(200);
    expect(payment.status).toBe('PENDING');

    const succeeded = await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));
    expect(succeeded.status).toBe(200);
    expect(payment.status).toBe('SUCCEEDED');
    expect(activeGrants()).toHaveLength(1);
    expect(activeGrants()[0]).toMatchObject({ userId: 'user_1', source: 'STRIPE_TIP', paymentId: payment.id });
    expect(sendBecomePatronEmail).toHaveBeenCalledTimes(1);
    expect(db.stripeEvent.rows.map((row: any) => row.status)).toEqual(['PROCESSED', 'PROCESSED']);
  });

  it('records a payment an older version had already marked FAILED', async () => {
    const payment = seedPayment({ status: 'FAILED' });

    const response = await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));

    expect(response.status).toBe(200);
    expect(payment.status).toBe('SUCCEEDED');
    expect(activeGrants()).toHaveLength(1);
  });

  it('marks every payer as a supporter, whatever the amount (no threshold)', async () => {
    const payment = seedPayment({ amountMinor: 300, currency: 'EUR' });

    await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id, { amount: 300, currency: 'eur' })));

    expect(payment.status).toBe('SUCCEEDED');
    expect(activeGrants()).toHaveLength(1);
  });

  it('acknowledges a redelivered event once and thanks the payer only once', async () => {
    const payment = seedPayment();
    const first = signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id), { id: 'evt_same' });
    const again = signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id), { id: 'evt_same' });

    expect((await POST(first)).status).toBe(200);
    const second = await POST(again);

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({ received: true, outcome: 'duplicate' });
    expect(db.stripeEvent.rows).toHaveLength(1);
    expect(sendBecomePatronEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a payload signed with another secret and stores nothing', async () => {
    const payment = seedPayment();

    const response = await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id), { secret: 'whsec_wrong' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'PAYMENT_WEBHOOK_SIGNATURE_ERROR' });
    expect(db.stripeEvent.rows).toHaveLength(0);
    expect(payment.status).toBe('PENDING');
  });

  it('rejects a modified body even with a valid header', async () => {
    const payment = seedPayment();
    const request = signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id));
    const tampered = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': request.headers.get('stripe-signature')! },
      body: (await request.text()).replace('"amount":1000', '"amount":1'),
    });

    expect((await POST(tampered)).status).toBe(400);
    expect(payment.status).toBe('PENDING');
  });

  it('returns 500 (so Stripe retries) when the signing secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await POST(signedRequest('payment_intent.succeeded', intent('pi_x', 'pay_x')));

    expect(response.status).toBe(500);
    expect(db.stripeEvent.rows).toHaveLength(0);
  });

  it('acknowledges intents not created by the app instead of failing for 3 days', async () => {
    const response = await POST(signedRequest('payment_intent.succeeded', intent('pi_payment_link', null)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, outcome: 'ignored' });
  });

  it('ignores a live event when the server runs on test keys', async () => {
    const payment = seedPayment();

    const response = await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id), { livemode: true }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ outcome: 'ignored' });
    expect(payment.status).toBe('PENDING');
  });

  it('marks an unpaid payment CANCELED on payment_intent.canceled', async () => {
    const payment = seedPayment();

    await POST(signedRequest('payment_intent.canceled', intent(payment.stripeIntentId, payment.id, { status: 'canceled' })));

    expect(payment.status).toBe('CANCELED');
  });
});

describe('refunds and disputes keep the supporter marker while another paid tip exists (PAY-05)', () => {
  async function payTwice() {
    const first = seedPayment();
    const second = seedPayment();
    await POST(signedRequest('payment_intent.succeeded', intent(first.stripeIntentId, first.id)));
    await POST(signedRequest('payment_intent.succeeded', intent(second.stripeIntentId, second.id)));
    return { first, second };
  }

  function charge(paymentIntent: string, amountRefunded: number) {
    stripeRefunds.set(paymentIntent, amountRefunded > 0 ? [{ id: `re_${paymentIntent}`, amount: amountRefunded, status: 'succeeded' }] : []);
    return { id: `ch_${paymentIntent}`, object: 'charge', payment_intent: paymentIntent, amount_refunded: amountRefunded, metadata: {} };
  }

  it('a full refund of the first tip keeps the marker; refunding the last one removes it', async () => {
    const { first, second } = await payTwice();
    expect(activeGrants()).toHaveLength(1);
    const grant = activeGrants()[0];

    await POST(signedRequest('charge.refunded', charge(first.stripeIntentId, 1000)));
    expect(first.status).toBe('REFUNDED');
    expect(activeGrants()).toHaveLength(1);

    await POST(signedRequest('charge.refunded', charge(second.stripeIntentId, 1000)));
    expect(second.status).toBe('REFUNDED');
    expect(activeGrants()).toHaveLength(0);
    // The reason the grant was given stays; the revocation has its own field (PAY-25).
    expect(grant.reason).toBe('Successful tip');
    expect(grant.revokeReason).toContain('fully refunded');
  });

  it('a partial refund keeps the marker', async () => {
    const payment = seedPayment();
    await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));

    await POST(signedRequest('charge.refunded', charge(payment.stripeIntentId, 400)));

    expect(payment.status).toBe('PARTIALLY_REFUNDED');
    expect(activeGrants()).toHaveLength(1);
  });

  function dispute(id: string, paymentIntent: string, status: string) {
    return { id, object: 'dispute', payment_intent: paymentIntent, status };
  }

  it('a dispute suspends the only tip and a won dispute restores it', async () => {
    const payment = seedPayment();
    await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));

    disputesRetrieve.mockResolvedValueOnce({ id: 'dp_1', status: 'needs_response' });
    await POST(signedRequest('charge.dispute.created', dispute('dp_1', payment.stripeIntentId, 'needs_response')));
    expect(payment.status).toBe('DISPUTED');
    expect(activeGrants()).toHaveLength(0);

    disputesRetrieve.mockResolvedValueOnce({ id: 'dp_1', status: 'won' });
    await POST(signedRequest('charge.dispute.closed', dispute('dp_1', payment.stripeIntentId, 'won')));
    expect(payment.status).toBe('SUCCEEDED');
    expect(activeGrants()).toHaveLength(1);
  });

  it('a late "created" event after the dispute was already won changes nothing (PAY-09)', async () => {
    const payment = seedPayment();
    await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));

    // Stripe delivers created after closed; the handler reads the current status (won).
    disputesRetrieve.mockResolvedValue({ id: 'dp_2', status: 'won' });
    await POST(signedRequest('charge.dispute.closed', dispute('dp_2', payment.stripeIntentId, 'won')));
    await POST(signedRequest('charge.dispute.created', dispute('dp_2', payment.stripeIntentId, 'needs_response')));

    expect(payment.status).toBe('SUCCEEDED');
    expect(activeGrants()).toHaveLength(1);
  });

  it('a dispute on a partially refunded tip goes back to PARTIALLY_REFUNDED when won (PAY-26)', async () => {
    const payment = seedPayment();
    await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));
    await POST(signedRequest('charge.refunded', charge(payment.stripeIntentId, 300)));

    disputesRetrieve.mockResolvedValueOnce({ id: 'dp_3', status: 'under_review' });
    await POST(signedRequest('charge.dispute.created', dispute('dp_3', payment.stripeIntentId, 'under_review')));
    disputesRetrieve.mockResolvedValueOnce({ id: 'dp_3', status: 'warning_closed' });
    await POST(signedRequest('charge.dispute.closed', dispute('dp_3', payment.stripeIntentId, 'warning_closed')));

    expect(payment.status).toBe('PARTIALLY_REFUNDED');
  });
});
