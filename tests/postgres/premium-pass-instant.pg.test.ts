/**
 * "Premium od razu po płatności" on a real Postgres: the confirmation the checkout asks for right after Stripe.js
 * reports the payment (GET /api/payments/[paymentId] -> getOwnedPaymentStatus) checks the PaymentIntent in Stripe on
 * the server and grants through the same idempotent fulfillPayment() as the webhook. Checked here:
 *  - signed out: 401, nothing read; someone else's payment: 404, Stripe never asked, nothing granted;
 *  - Stripe `processing`: no access, a readable PROCESSING answer;
 *  - Stripe `succeeded`: access once; repeated confirmations and a later (or simultaneous) webhook add nothing
 *    (one payment in the access, one period, the payer's total counted once);
 *  - an intent whose metadata names another account is never granted (fulfillPayment's check);
 *  - a premium-key payment is checked with the premium key set.
 * Stripe (the SDK client), e-mail, notifications, the session and the rate limit are replaced; Prisma, transactions,
 * row locks and advisory locks are real. No request reaches Stripe.
 *
 *   set -a; . ~/.pp-test-db.env; set +a; export DATABASE_URL_UNPOOLED=$DATABASE_URL
 *   npx vitest run --config vitest.postgres.config.ts tests/postgres/premium-pass-instant.pg.test.ts
 */
import { PaymentStatus, PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/modules/email', () => ({
  sendBecomePatronEmail: vi.fn().mockResolvedValue(undefined),
  sendDonationThankYouEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/modules/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/notifications')>()),
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));
const retrieve = vi.fn();
const usedKeySets: string[] = [];
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: (keySet?: string) => {
    usedKeySets.push(keySet ?? 'default');
    return { paymentIntents: { retrieve: (...args: unknown[]) => retrieve(...args) }, refunds: { create: vi.fn(), list: vi.fn() } };
  },
}));
const session = { userId: null as string | null };
vi.mock('@/lib/auth/server', () => ({ auth: vi.fn(async () => ({ userId: session.userId })) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true, remaining: 59 })) }));

import { GET } from '@/app/api/payments/[paymentId]/route';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { getOwnedPaymentStatus } from '@/lib/modules/payments/application/get-payment-status.use-case';
import { listVipUserIds, viewerPassState } from '@/lib/modules/patron-zone';

const prisma = new PrismaClient();
const RUN = `pg-pinst-${Date.now().toString(36)}`;
const payer = `${RUN}-payer`;
const other = `${RUN}-other`;
const key = `xp.premium_pass:${payer}`;
const PRICE = 1499; // ACCESS_30D in PLN
const DAY = 86_400_000;
let seq = 0;

const userCtx = (userId: string) => createAppContext({ actor: { type: 'user', userId }, prisma });
const systemCtx = () => createAppContext({ actor: { type: 'system', reason: 'pg-test-webhook' }, prisma });

async function pendingPremiumPayment(opts: { userId?: string; keySet?: 'premium' } = {}) {
  const n = ++seq;
  return prisma.payment.create({
    data: {
      userId: opts.userId ?? payer, amountMinor: PRICE, currency: 'PLN', status: PaymentStatus.PENDING, stripeIntentId: `pi_${RUN}_${n}`,
      metadata: {
        purpose: 'premium_pass', productId: 'ACCESS_30D', consents: { termsVersion: 'test-v1', waiverAt: new Date().toISOString() },
        ...(opts.keySet ? { stripeKeySet: opts.keySet } : {}),
      },
    },
  });
}

/** What Stripe would answer for this payment's intent. */
function stripeSays(payment: { stripeIntentId: string | null; userId: string | null }, status: string, metadataUserId = payment.userId) {
  retrieve.mockImplementation(async (id: string) => {
    expect(id).toBe(payment.stripeIntentId); // only the intent stored on the payer's own payment is ever looked up
    return { id, status, amount: PRICE, currency: 'pln', metadata: { userId: metadataUserId } };
  });
}

/** The webhook's call for `payment_intent.succeeded` (same use case, system actor). */
const webhook = (payment: { id: string; stripeIntentId: string | null }) => fulfillPayment({
  paymentId: payment.id, stripeIntentId: payment.stripeIntentId!, metadataUserId: payer, amountMinor: PRICE, currency: 'pln', notifyPayer: false,
}, systemCtx());

const callRoute = (paymentId: string) => GET(new NextRequest(`http://localhost/api/payments/${paymentId}`), { params: Promise.resolve({ paymentId }) });

async function ledger() {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  const stored = row ? (JSON.parse(row.value) as { paymentIds: string[]; expiresAt: string; totalMinor: number }) : null;
  const total = await prisma.userPaymentTotal.findUnique({ where: { userId_currency: { userId: payer, currency: 'PLN' } } });
  const now = new Date();
  const state = await viewerPassState(userCtx(payer), now);
  const vip = (await listVipUserIds(prisma, [payer], now)).has(payer);
  return { stored, total: total?.amountMinor ?? 0, active: state.state === 'active', vip };
}

async function reset() {
  for (const userId of [payer, other]) {
    await prisma.patronGrant.deleteMany({ where: { userId } });
    await prisma.userPaymentTotal.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.appSetting.deleteMany({ where: { key: `xp.premium_pass:${userId}` } });
  }
  retrieve.mockReset();
  usedKeySets.length = 0;
  session.userId = null;
}

beforeAll(async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_pg_instant');
  vi.stubEnv('PREMIUM_PASS_STRIPE_SECRET_KEY', 'sk_test_pg_instant_premium');
  await prisma.user.createMany({ data: [payer, other].map((id) => ({ id, email: `${id}@example.test`, name: id })) });
});
beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.user.deleteMany({ where: { id: { in: [payer, other] } } });
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

describe('confirmation right after the payment (GET /api/payments/[id])', () => {
  it('signed out: 401, nothing read, Stripe not asked', async () => {
    const payment = await pendingPremiumPayment();
    const res = await callRoute(payment.id);
    expect(res.status).toBe(401);
    expect(retrieve).not.toHaveBeenCalled();
    expect((await ledger()).active).toBe(false);
  });

  it("someone else's payment: 404, Stripe not asked, nobody gets access", async () => {
    const payment = await pendingPremiumPayment();
    stripeSays(payment, 'succeeded');
    session.userId = other;
    const res = await callRoute(payment.id);
    expect(res.status).toBe(404);
    expect(retrieve).not.toHaveBeenCalled();
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(PaymentStatus.PENDING);
    expect(await ledger()).toMatchObject({ stored: null, active: false, vip: false });
    expect(await prisma.appSetting.findUnique({ where: { key: `xp.premium_pass:${other}` } })).toBeNull();
  });

  it('Stripe still processing (BLIK / bank): no access and a readable PROCESSING answer', async () => {
    const payment = await pendingPremiumPayment();
    stripeSays(payment, 'processing');
    session.userId = payer;
    const res = await callRoute(payment.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: payment.id, status: 'PENDING', uiStatus: 'PROCESSING' });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(await ledger()).toMatchObject({ stored: null, total: 0, active: false, vip: false });
  });

  it('Stripe succeeded: access at once; repeated confirmations and the later webhook change nothing', async () => {
    const payment = await pendingPremiumPayment();
    stripeSays(payment, 'succeeded');
    session.userId = payer;

    const res = await callRoute(payment.id);
    expect(await res.json()).toMatchObject({ status: 'SUCCEEDED', uiStatus: 'SUCCEEDED' });
    const first = await ledger();
    expect(first).toMatchObject({ active: true, vip: true, total: PRICE });
    expect(first.stored?.paymentIds).toEqual([payment.id]);
    expect(first.stored?.totalMinor).toBe(PRICE);
    expect((Date.parse(first.stored!.expiresAt) - Date.now()) / DAY).toBeGreaterThan(29.9);

    // The poll asks again (already SUCCEEDED: Stripe is not asked any more), then the webhook arrives.
    for (let i = 0; i < 3; i++) expect(await (await callRoute(payment.id)).json()).toMatchObject({ uiStatus: 'SUCCEEDED' });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect((await webhook(payment)).ok).toBe(true);
    expect((await webhook(payment)).ok).toBe(true); // Stripe redelivers

    expect(await ledger()).toEqual(first); // one payment, one period, the total counted once
  });

  it('confirmation and webhook at the same moment: granted exactly once', async () => {
    const payment = await pendingPremiumPayment();
    stripeSays(payment, 'succeeded');
    const results = await Promise.all([
      getOwnedPaymentStatus({ paymentId: payment.id, userId: payer }, userCtx(payer)),
      webhook(payment),
      getOwnedPaymentStatus({ paymentId: payment.id, userId: payer }, userCtx(payer)),
      webhook(payment),
    ]);
    results.forEach((result) => expect(result.ok).toBe(true));
    const after = await ledger();
    expect(after).toMatchObject({ active: true, vip: true, total: PRICE });
    expect(after.stored?.paymentIds).toEqual([payment.id]);
    expect(after.stored?.totalMinor).toBe(PRICE);
    expect((Date.parse(after.stored!.expiresAt) - Date.now()) / DAY).toBeLessThan(30.1); // not 60 days
  });

  it('an intent whose metadata names another account is not granted', async () => {
    const payment = await pendingPremiumPayment();
    stripeSays(payment, 'succeeded', other);
    const result = await getOwnedPaymentStatus({ paymentId: payment.id, userId: payer }, userCtx(payer));
    expect(result.ok && result.data?.uiStatus).toBe('PROCESSING');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(PaymentStatus.PENDING);
    expect(await ledger()).toMatchObject({ stored: null, active: false, vip: false });
  });

  it('a payment made with the premium key set is checked with the premium keys', async () => {
    const payment = await pendingPremiumPayment({ keySet: 'premium' });
    stripeSays(payment, 'succeeded');
    const result = await getOwnedPaymentStatus({ paymentId: payment.id, userId: payer }, userCtx(payer));
    expect(result.ok && result.data?.uiStatus).toBe('SUCCEEDED');
    expect(usedKeySets).toEqual(['premium']);
    expect((await ledger()).active).toBe(true);
  });
});
