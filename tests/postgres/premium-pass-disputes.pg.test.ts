/**
 * Premium access and Stripe disputes on a real Postgres (owner decision DP01, 2026-11-25):
 *  - dispute open  -> the payment's access is SUSPENDED (stored grant untouched),
 *  - dispute won   -> it is back by itself,
 *  - dispute lost  -> it is taken away for good (revokePatronAccessForPayment),
 *  - another valid payment keeps its own period; a partial refund changes nothing; a full refund revokes as before.
 * The VIP marker (comment badge, avatar ring) uses the same reader, so it follows the same rule.
 * Stripe, e-mail and notifications are replaced; Prisma, transactions, row locks and advisory locks are real.
 *
 *   set -a; . ~/.pp-test-db.env; set +a; export DATABASE_URL_UNPOOLED=$DATABASE_URL
 *   npx vitest run --config vitest.postgres.config.ts tests/postgres/premium-pass-disputes.pg.test.ts
 */
import { PaymentStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/modules/email', () => ({
  sendBecomePatronEmail: vi.fn().mockResolvedValue(undefined),
  sendDonationThankYouEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/modules/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/notifications')>()),
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: () => ({ refunds: { create: vi.fn(), list: vi.fn() } }),
}));

import { createAppContext } from '@/lib/modules/shared/app-context';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { handleDispute } from '@/lib/modules/payments/application/handle-dispute.use-case';
import { listVipUserIds, readEffectivePass, viewerPassState } from '@/lib/modules/patron-zone';

const prisma = new PrismaClient();
const RUN = `pg-pdisp-${Date.now().toString(36)}`;
const userId = `${RUN}-user`;
const key = `xp.premium_pass:${userId}`;
const DAY = 86_400_000;
const PRICE = 1499; // ACCESS_30D in PLN
const ctx = () => createAppContext({ actor: { type: 'system', reason: 'pg-test' }, prisma });
let seq = 0;

async function premiumPayment() {
  const n = ++seq;
  const payment = await prisma.payment.create({
    data: {
      userId, amountMinor: PRICE, currency: 'PLN', status: PaymentStatus.PENDING, stripeIntentId: `pi_${RUN}_${n}`,
      metadata: { purpose: 'premium_pass', productId: 'ACCESS_30D', consents: { termsVersion: 'test-v1', waiverAt: new Date().toISOString() } },
    },
  });
  const result = await fulfillPayment({
    paymentId: payment.id, stripeIntentId: payment.stripeIntentId!, metadataUserId: userId, amountMinor: PRICE, currency: 'pln', notifyPayer: false,
  }, ctx());
  expect(result.ok).toBe(true);
  return payment;
}

const dispute = (p: { stripeIntentId: string | null }, status: string, id = `dp_${RUN}_${p.stripeIntentId}`) =>
  handleDispute({ stripeIntentId: p.stripeIntentId!, disputeId: id, status }, ctx());
const stored = async () => JSON.parse((await prisma.appSetting.findUniqueOrThrow({ where: { key } })).value) as { paymentIds: string[]; expiresAt: string; totalMinor: number };
const status = async (id: string) => (await prisma.payment.findUniqueOrThrow({ where: { id } })).status;
/** What every reader sees: the playback gate/sidebar (viewerPassState) and the VIP badge/avatar ring (listVipUserIds). */
async function access() {
  const now = new Date();
  const state = await viewerPassState(createAppContext({ actor: { type: 'user', userId }, prisma }), now);
  const vip = (await listVipUserIds(prisma, [userId], now)).has(userId);
  expect(vip).toBe(state.state === 'active'); // the badge never disagrees with the access
  const effective = await readEffectivePass(prisma, userId, now);
  return { active: state.state === 'active', vip, daysLeft: effective?.expiresAt ? (Date.parse(effective.expiresAt) - now.getTime()) / DAY : 0 };
}

async function resetUser() {
  await prisma.patronGrant.deleteMany({ where: { userId } });
  await prisma.userPaymentTotal.deleteMany({ where: { userId } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.appSetting.deleteMany({ where: { key } });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test`, name: RUN } });
});
beforeEach(resetUser);
afterAll(async () => {
  await resetUser();
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('Premium access follows the dispute of its payment', () => {
  it('open dispute suspends the access (stored grant untouched), a won dispute brings it back with its original end', async () => {
    const payment = await premiumPayment();
    const before = await stored();
    expect(await access()).toMatchObject({ active: true, vip: true });

    await dispute(payment, 'needs_response');
    expect(await status(payment.id)).toBe('DISPUTED');
    expect(await access()).toMatchObject({ active: false, vip: false });
    expect(await stored()).toEqual(before); // suspended, not revoked

    await dispute(payment, 'under_review'); // later open state: still suspended
    expect(await access()).toMatchObject({ active: false, vip: false });

    await dispute(payment, 'won');
    expect(await status(payment.id)).toBe('SUCCEEDED');
    expect(await stored()).toEqual(before);
    const after = await access();
    expect(after).toMatchObject({ active: true, vip: true });
    expect(after.daysLeft).toBeGreaterThan(29);
  });

  it('a lost dispute takes the access away for good (also when lost without an open phase)', async () => {
    const viaOpen = await premiumPayment();
    await dispute(viaOpen, 'needs_response');
    await dispute(viaOpen, 'lost');
    expect(await status(viaOpen.id)).toBe('CHARGEBACK_LOST');
    expect((await stored()).paymentIds).toEqual([]);
    expect(Date.parse((await stored()).expiresAt)).toBeLessThanOrEqual(Date.now() + 1_000);
    expect(await access()).toMatchObject({ active: false, vip: false });

    await resetUser();
    const direct = await premiumPayment();
    await dispute(direct, 'lost');
    expect((await stored()).paymentIds).toEqual([]);
    expect(await access()).toMatchObject({ active: false, vip: false });
  });

  it('two payments, one disputed: the access stays from the other (open: 30 days suspended; lost: removed)', async () => {
    const first = await premiumPayment();
    const second = await premiumPayment();
    expect((await access()).daysLeft).toBeGreaterThan(58);

    await dispute(second, 'needs_response');
    const open = await access();
    expect(open).toMatchObject({ active: true, vip: true });
    expect(open.daysLeft).toBeGreaterThan(28);
    expect(open.daysLeft).toBeLessThan(31);

    await dispute(second, 'lost');
    expect((await stored()).paymentIds).toEqual([first.id]);
    const lost = await access();
    expect(lost).toMatchObject({ active: true, vip: true });
    expect(lost.daysLeft).toBeGreaterThan(28);
    expect(lost.daysLeft).toBeLessThan(31);
  });

  it('a partial refund keeps the access unchanged; a full refund revokes it as before', async () => {
    const payment = await premiumPayment();
    const before = await stored();
    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 500 }, ctx());
    expect(await status(payment.id)).toBe('PARTIALLY_REFUNDED');
    expect(await stored()).toEqual(before);
    expect(await access()).toMatchObject({ active: true, vip: true });

    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: PRICE }, ctx());
    expect(await status(payment.id)).toBe('REFUNDED');
    expect((await stored()).paymentIds).toEqual([]);
    expect(await access()).toMatchObject({ active: false, vip: false });
  });

  it('partial refund, then an open dispute suspends; won goes back to PARTIALLY_REFUNDED with the access', async () => {
    const payment = await premiumPayment();
    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 500 }, ctx());
    await dispute(payment, 'needs_response');
    expect(await access()).toMatchObject({ active: false, vip: false });
    await dispute(payment, 'won');
    expect(await status(payment.id)).toBe('PARTIALLY_REFUNDED');
    expect(await access()).toMatchObject({ active: true, vip: true });
  });

  it('a full refund recorded while disputed, then a won dispute: REFUNDED and no access (a full refund always revokes)', async () => {
    const payment = await premiumPayment();
    await dispute(payment, 'needs_response');
    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: PRICE }, ctx());
    expect(await status(payment.id)).toBe('DISPUTED');
    await dispute(payment, 'won');
    expect(await status(payment.id)).toBe('REFUNDED');
    expect((await stored()).paymentIds).toEqual([]);
    expect(await access()).toMatchObject({ active: false, vip: false });
  });

  it('replayed events change nothing (idempotent)', async () => {
    const keep = await premiumPayment();
    const payment = await premiumPayment();
    await dispute(payment, 'needs_response');
    await dispute(payment, 'needs_response');
    const suspended = await stored();
    expect(suspended.paymentIds).toEqual([keep.id, payment.id]);

    const first = await dispute(payment, 'lost');
    const afterLost = await stored();
    const replay = await dispute(payment, 'lost');
    expect(first.ok && first.data.changed).toBe(true);
    expect(replay.ok && replay.data.changed).toBe(false);
    expect(await stored()).toEqual(afterLost);
    expect(afterLost.paymentIds).toEqual([keep.id]);
    expect(afterLost.totalMinor).toBe(PRICE);

    // a late "won"/open event after the loss never moves the payment back nor restores its access
    await dispute(payment, 'won');
    await dispute(payment, 'needs_response');
    expect(await status(payment.id)).toBe('CHARGEBACK_LOST');
    expect(await stored()).toEqual(afterLost);
  });

  it('concurrent events: duplicate losses, a loss racing a full refund, and losses on two payments of one account', async () => {
    const a = await premiumPayment();
    const b = await premiumPayment();
    const c = await premiumPayment();

    // same payment, several deliveries at once
    const results = await Promise.all([dispute(a, 'lost'), dispute(a, 'lost'), dispute(a, 'lost')]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.data.changed)).toHaveLength(1);

    // a loss and a full refund of another payment, and an open dispute of a third, all at once
    const mixed = await Promise.all([
      dispute(b, 'lost'),
      handleRefund({ paymentId: c.id, reportedRefundedMinor: PRICE }, ctx()),
      dispute(b, 'needs_response'),
    ]);
    expect(mixed.every((r) => r.ok)).toBe(true);

    const record = await stored();
    expect(record.paymentIds).toEqual([]);
    expect(record.totalMinor).toBe(0);
    expect(await access()).toMatchObject({ active: false, vip: false });
    expect(await status(a.id)).toBe('CHARGEBACK_LOST');
    expect(await status(b.id)).toBe('CHARGEBACK_LOST');
    expect(await status(c.id)).toBe('REFUNDED');
  });

  it('concurrent open and won deliveries of one dispute end consistent with the final payment status', async () => {
    const payment = await premiumPayment();
    await Promise.all([dispute(payment, 'needs_response'), dispute(payment, 'needs_response')]);
    expect(await access()).toMatchObject({ active: false });
    await Promise.all([dispute(payment, 'won'), dispute(payment, 'won')]);
    expect(await status(payment.id)).toBe('SUCCEEDED');
    expect(await access()).toMatchObject({ active: true, vip: true });
  });
});
