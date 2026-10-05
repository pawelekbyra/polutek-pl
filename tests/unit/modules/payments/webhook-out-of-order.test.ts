/**
 * Payments audit 2026-10-05: events that reach the webhook before the payment was recorded as paid
 * (Stripe does not guarantee event order, and the webhook may have been down while the cron catches up),
 * a stale-timestamp replay, and a database outage. Same harness as stripe-webhook-signed.test.ts.
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


function charge(paymentIntent: string, amountRefunded: number) {
  stripeRefunds.set(paymentIntent, amountRefunded > 0 ? [{ id: `re_${paymentIntent}`, amount: amountRefunded, status: 'succeeded' }] : []);
  return { id: `ch_${paymentIntent}`, object: 'charge', payment_intent: paymentIntent, amount_refunded: amountRefunded, metadata: {} };
}

describe('events for a payment that is not recorded as paid yet', () => {
  it('charge.refunded on a PENDING payment is retried later instead of corrupting the ledger', async () => {
    const payment = seedPayment();

    const early = await POST(signedRequest('charge.refunded', charge(payment.stripeIntentId, 400)));

    // 5xx so Stripe redelivers; nothing was written for the payment.
    expect(early.status).toBeGreaterThanOrEqual(500);
    expect(payment.status).toBe('PENDING');
    expect(payment.refundedAmountMinor).toBe(0);
    expect(db.stripeEvent.rows[0].status).toBe('FAILED');
  });

  it('after the payment is recorded the redelivered refund event applies (supporter marker and totals intact)', async () => {
    const payment = seedPayment();
    const refundEvent = signedRequest('charge.refunded', charge(payment.stripeIntentId, 400), { id: 'evt_refund_early' });
    await POST(refundEvent.clone());

    await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));
    expect(payment.status).toBe('SUCCEEDED');
    expect(db.userPaymentTotal.rows[0].amountMinor).toBe(1000);

    const retry = await POST(refundEvent);
    expect(retry.status).toBe(200);
    expect(payment.status).toBe('PARTIALLY_REFUNDED');
    expect(payment.refundedAmountMinor).toBe(400);
    expect(activeGrants()).toHaveLength(1);
  });

  it('a dispute event on a PENDING payment is retried later instead of being dropped', async () => {
    const payment = seedPayment();
    disputesRetrieve.mockResolvedValue({ id: 'dp_early', status: 'needs_response' });

    const early = await POST(signedRequest('charge.dispute.created', { id: 'dp_early', object: 'dispute', payment_intent: payment.stripeIntentId, status: 'needs_response' }));

    expect(early.status).toBeGreaterThanOrEqual(500);
    expect(db.stripeEvent.rows[0].status).toBe('FAILED');
  });
});

describe('webhook transport guarantees', () => {
  it('rejects a correctly signed payload whose timestamp is outside the 5 minute tolerance (replay)', async () => {
    const payload = JSON.stringify({ id: 'evt_old', object: 'event', type: 'payment_intent.succeeded', livemode: false, created: 1, data: { object: intent('pi_x', 'pay_x') } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    const response = await POST(new NextRequest('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': header }, body: payload }));

    expect(response.status).toBe(400);
    expect(db.stripeEvent.rows).toHaveLength(0);
  });

  it('returns 5xx (so Stripe retries) when the database is down, and never acknowledges the event', async () => {
    const payment = seedPayment();
    const original = db.stripeEvent.create;
    db.stripeEvent.create = async () => { throw new Error('connection refused'); };
    try {
      const response = await POST(signedRequest('payment_intent.succeeded', intent(payment.stripeIntentId, payment.id)));
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(payment.status).toBe('PENDING');
    } finally {
      db.stripeEvent.create = original;
    }
  });
});
