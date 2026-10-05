/**
 * PA-04: refund events are only a pointer to a payment; the amount is Stripe's CURRENT refund list.
 * A refund that fails or is canceled after charge.refunded (BLIK/P24/bank refunds) stops counting, and an
 * old, replayed charge.refunded cannot bring it back. Same harness as stripe-webhook-signed.test.ts.
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


import { fetchEffectiveRefundedMinor, sumEffectiveRefunds } from '@/lib/modules/payments/infrastructure/stripe-refunds';

function seedPaid(overrides: Record<string, unknown> = {}) {
  const row = {
    id: `pay_${db.payment.rows.length + 1}`,
    userId: 'user_1',
    creatorId: 'creator_1',
    amountMinor: 1000,
    currency: 'PLN',
    status: 'SUCCEEDED',
    stripeIntentId: `pi_${db.payment.rows.length + 1}`,
    refundedAmountMinor: 0,
    requestId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  db.payment.rows.push(row);
  return row;
}

const setRefunds = (intentId: string, refunds: Array<{ id: string; amount: number; status: string }>) => stripeRefunds.set(intentId, refunds);
const refundObject = (intentId: string, id: string, status: string) => ({ id, object: 'refund', payment_intent: intentId, status, amount: 0 });
const chargeObject = (intentId: string) => ({ id: `ch_${intentId}`, object: 'charge', payment_intent: intentId, metadata: {} });

beforeEach(() => {
  for (const name of ['payment', 'stripeEvent', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl' });
  vi.clearAllMocks();
  stripeRefunds.clear();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
});

describe('refund.failed / refund.updated (BLIK, P24 and bank refunds can come back)', () => {
  it('a refund that failed after charge.refunded stops counting: status and amount go back', async () => {
    const payment = seedPaid();
    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 400, status: 'pending' }]);
    expect((await POST(signedRequest('charge.refunded', chargeObject(payment.stripeIntentId)))).status).toBe(200);
    expect(payment).toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 400 });

    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 400, status: 'failed' }]);
    const failed = await POST(signedRequest('refund.failed', refundObject(payment.stripeIntentId, 're_1', 'failed')));

    expect(failed.status).toBe(200);
    expect(payment).toMatchObject({ status: 'SUCCEEDED', refundedAmountMinor: 0 });
    expect(payment.refundedById ?? null).toBeNull();
  });

  it('a fully refunded tip whose refund failed counts again, with its supporter marker', async () => {
    const payment = seedPaid();
    db.patronGrant.rows.push({ id: 'g1', userId: 'user_1', source: 'STRIPE_TIP', paymentId: payment.id, revokedAt: null });
    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 1000, status: 'succeeded' }]);
    await POST(signedRequest('charge.refunded', chargeObject(payment.stripeIntentId)));
    expect(payment.status).toBe('REFUNDED');
    expect(db.patronGrant.rows[0].revokedAt).not.toBeNull();

    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 1000, status: 'failed' }]);
    await POST(signedRequest('refund.failed', refundObject(payment.stripeIntentId, 're_1', 'failed')));

    expect(payment).toMatchObject({ status: 'SUCCEEDED', refundedAmountMinor: 0 });
    expect(db.patronGrant.rows.filter((g: any) => g.revokedAt == null)).toHaveLength(1);
  });

  it('a replayed old charge.refunded cannot bring a failed refund back (Stripe\'s current list decides)', async () => {
    const payment = seedPaid();
    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 400, status: 'pending' }]);
    const early = signedRequest('charge.refunded', chargeObject(payment.stripeIntentId), { id: 'evt_charge_refunded_old' });
    await POST(early.clone());
    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 400, status: 'failed' }]);
    await POST(signedRequest('refund.failed', refundObject(payment.stripeIntentId, 're_1', 'failed')));
    expect(payment.refundedAmountMinor).toBe(0);

    // Stripe delivers the old event again (a different event id, e.g. a manual resend).
    await POST(signedRequest('charge.refunded', chargeObject(payment.stripeIntentId)));

    expect(payment).toMatchObject({ status: 'SUCCEEDED', refundedAmountMinor: 0 });
  });

  it('a canceled refund (refund.updated) stops counting; a still pending one counts', async () => {
    const payment = seedPaid();
    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 300, status: 'requires_action' }, { id: 're_2', amount: 200, status: 'pending' }]);
    await POST(signedRequest('refund.updated', refundObject(payment.stripeIntentId, 're_2', 'pending')));
    expect(payment.refundedAmountMinor).toBe(500);

    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 300, status: 'canceled' }, { id: 're_2', amount: 200, status: 'pending' }]);
    await POST(signedRequest('refund.updated', refundObject(payment.stripeIntentId, 're_1', 'canceled')));
    expect(payment).toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 200 });
  });

  it('a refund made in the Dashboard while the app saw nothing is caught up from any refund event', async () => {
    const payment = seedPaid();
    setRefunds(payment.stripeIntentId, [{ id: 're_a', amount: 250, status: 'succeeded' }, { id: 're_b', amount: 250, status: 'succeeded' }]);
    await POST(signedRequest('refund.created', refundObject(payment.stripeIntentId, 're_b', 'succeeded')));
    expect(payment).toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 500 });
  });

  it('a refund of a charge without a PaymentIntent, or of an unknown intent, is acknowledged and changes nothing', async () => {
    const payment = seedPaid();
    const noIntent = await POST(signedRequest('refund.failed', { id: 're_x', object: 'refund', payment_intent: null, status: 'failed' }));
    const unknown = await POST(signedRequest('refund.failed', refundObject('pi_unknown', 're_y', 'failed')));
    expect(noIntent.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(refundsList).not.toHaveBeenCalledWith(expect.objectContaining({ payment_intent: null }), expect.anything());
    expect(payment).toMatchObject({ status: 'SUCCEEDED', refundedAmountMinor: 0 });
  });

  it('a Stripe outage makes the event fail (5xx) so Stripe redelivers it', async () => {
    const payment = seedPaid();
    refundsList.mockRejectedValueOnce(new Error('stripe down'));
    const response = await POST(signedRequest('refund.failed', refundObject(payment.stripeIntentId, 're_1', 'failed')));
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(db.stripeEvent.rows[0].status).toBe('FAILED');
  });

  it('a disputed tip keeps DISPUTED when a refund on it fails', async () => {
    const payment = seedPaid({ status: 'DISPUTED', refundedAmountMinor: 400 });
    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 400, status: 'failed' }]);
    await POST(signedRequest('refund.failed', refundObject(payment.stripeIntentId, 're_1', 'failed')));
    expect(payment).toMatchObject({ status: 'DISPUTED', refundedAmountMinor: 0 });
  });

  it('a refund on a payment that is not recorded as paid yet is retried later (5xx)', async () => {
    const payment = seedPaid({ status: 'PENDING' });
    setRefunds(payment.stripeIntentId, [{ id: 're_1', amount: 400, status: 'succeeded' }]);
    const response = await POST(signedRequest('refund.created', refundObject(payment.stripeIntentId, 're_1', 'succeeded')));
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(payment.refundedAmountMinor).toBe(0);
  });
});

describe('Stripe refund list helpers', () => {
  it('counts succeeded, pending and requires_action refunds; failed and canceled ones do not count', () => {
    expect(sumEffectiveRefunds([
      { amount: 100, status: 'succeeded' }, { amount: 200, status: 'pending' }, { amount: 300, status: 'requires_action' },
      { amount: 400, status: 'failed' }, { amount: 500, status: 'canceled' }, { amount: 50, status: null },
    ])).toBe(650);
  });

  it('reads every page of the list', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 're_1', amount: 100, status: 'succeeded' }], has_more: true })
      .mockResolvedValueOnce({ data: [{ id: 're_2', amount: 200, status: 'succeeded' }], has_more: false });
    const total = await fetchEffectiveRefundedMinor({ refunds: { list } } as never, 'pi_1');
    expect(total).toBe(300);
    expect(list.mock.calls[1][0]).toMatchObject({ payment_intent: 'pi_1', starting_after: 're_1' });
  });
});
