import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakePaymentsDb } from '../modules/payments/fake-payments-db';

const db = createFakePaymentsDb();
const intents = new Map<string, any>();
const stripe = {
  paymentIntents: {
    retrieve: vi.fn(async (id: string) => ({ ...intents.get(id) })),
    cancel: vi.fn(async (id: string) => {
      intents.get(id).status = 'canceled';
      return { ...intents.get(id) };
    }),
  },
};
const sendBecomePatronEmail = vi.fn();
const sendDonationThankYouEmail = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/lib/modules/email', () => ({
  sendBecomePatronEmail: (...args: unknown[]) => sendBecomePatronEmail(...args),
  sendDonationThankYouEmail: (...args: unknown[]) => sendDonationThankYouEmail(...args),
}));
vi.mock('@/lib/modules/notifications', () => ({
  sendNotification: vi.fn(),
  notificationTemplates: { supportThanks: { kind: 'PATRON', titlePl: 't', titleEn: 't', bodyPl: 'b', bodyEn: 'b' } },
}));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({ getStripeClient: () => stripe }));

const { GET } = await import('@/app/api/cron/stripe-reconciliation/route');

const HOUR = 60 * 60 * 1000;

function seed(id: string, status: string, ageMs: number, intentStatus: string | null) {
  const row = {
    id,
    userId: 'user_1',
    creatorId: 'creator_1',
    amountMinor: 1000,
    currency: 'PLN',
    status,
    stripeIntentId: intentStatus ? `pi_${id}` : null,
    refundedAmountMinor: 0,
    createdAt: new Date(Date.now() - ageMs),
    updatedAt: new Date(),
  };
  db.payment.rows.push(row);
  if (intentStatus) intents.set(`pi_${id}`, { id: `pi_${id}`, status: intentStatus, amount: 1000, currency: 'pln', metadata: { userId: 'user_1' } });
  return row;
}

function cronRequest(query = '') {
  return new NextRequest(`http://localhost/api/cron/stripe-reconciliation${query}`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

beforeEach(() => {
  for (const name of ['payment', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl' });
  intents.clear();
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'a'.repeat(40);
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
});

describe('stripe-reconciliation cron', () => {
  it('rejects calls without the cron secret', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/stripe-reconciliation'));
    expect(response.status).toBe(401);
  });

  it('records a pending payment Stripe reports as succeeded, at any age', async () => {
    const fresh = seed('fresh', 'PENDING', 1 * HOUR, 'succeeded');
    const old = seed('old', 'PENDING', 90 * 24 * HOUR, 'succeeded');

    const body = await (await GET(cronRequest())).json();

    expect(fresh.status).toBe('SUCCEEDED');
    expect(old.status).toBe('SUCCEEDED');
    expect(body).toMatchObject({ checked: 2, fulfilled: 2 });
    // A tip from months ago is recorded without a very late thank-you e-mail.
    expect(sendBecomePatronEmail.mock.calls.length + sendDonationThankYouEmail.mock.calls.length).toBe(1);
  });

  it('cancels an abandoned intent in Stripe before marking it CANCELED (PAY-37)', async () => {
    const abandoned = seed('abandoned', 'PENDING', 30 * HOUR, 'requires_payment_method');
    const recent = seed('recent', 'PENDING', 2 * HOUR, 'requires_payment_method');

    await GET(cronRequest());

    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_abandoned', { cancellation_reason: 'abandoned' });
    expect(abandoned.status).toBe('CANCELED');
    expect(recent.status).toBe('PENDING');
  });

  it('marks a canceled intent CANCELED, not FAILED', async () => {
    const payment = seed('canceled', 'PENDING', 2 * HOUR, 'canceled');

    await GET(cronRequest());

    expect(payment.status).toBe('CANCELED');
  });

  it('leaves FAILED rows alone in a routine run, recovers them with ?scope=recover (PAY-01)', async () => {
    const payment = seed('lost', 'FAILED', 40 * 24 * HOUR, 'succeeded');

    await GET(cronRequest());
    expect(payment.status).toBe('FAILED');

    const body = await (await GET(cronRequest('?scope=recover'))).json();
    expect(payment.status).toBe('SUCCEEDED');
    expect(body).toMatchObject({ scope: 'recover', fulfilled: 1 });
    expect(db.patronGrant.rows).toHaveLength(1);
  });

  it('cancels a pending row whose intent was never created', async () => {
    const payment = seed('orphan', 'PENDING', 30 * HOUR, null);

    await GET(cronRequest());

    expect(payment.status).toBe('CANCELED');
  });

  it('does not let abandoned rows whose intent Stripe no longer knows (e.g. test-mode intents under a live key) starve newer payments', async () => {
    for (let i = 0; i < 100; i++) {
      seed(`ghost${i}`, 'PENDING', 5 * 24 * HOUR + i, `ghost${i}`);
      intents.delete(`pi_ghost${i}`); // retrieve() will throw resource_missing for these
    }
    const real = seed('real', 'PENDING', 2 * HOUR, 'succeeded');
    stripe.paymentIntents.retrieve.mockImplementation(async (id: string) => {
      if (!intents.has(id)) throw Object.assign(new Error('No such payment_intent'), { type: 'StripeInvalidRequestError', code: 'resource_missing' });
      return { ...intents.get(id) };
    });

    const first = await (await GET(cronRequest())).json();
    expect(first).toMatchObject({ checked: 100, canceled: 100, errors: 0 });
    const second = await (await GET(cronRequest())).json();

    expect(second).toMatchObject({ checked: 1, fulfilled: 1 });
    expect(real.status).toBe('SUCCEEDED');
  });

  it('keeps a FRESH row whose intent is not found (could be a transient or wrong-key problem) for the next run', async () => {
    const payment = seed('fresh', 'PENDING', 2 * HOUR, 'succeeded');
    stripe.paymentIntents.retrieve.mockRejectedValueOnce(Object.assign(new Error('No such payment_intent'), { type: 'StripeInvalidRequestError', code: 'resource_missing' }));

    const body = await (await GET(cronRequest())).json();

    expect(body).toMatchObject({ errors: 1 });
    expect(payment.status).toBe('PENDING');
  });
});
