/**
 * Payments ledger on a real Postgres (payments audit 2026-10-05). The unit tests use an in-memory fake that
 * cannot prove row locking, the clamp-to-zero SQL or unique constraints; these do. Stripe, e-mail and
 * notifications are replaced, everything else (Prisma, transactions, StripeEvent lock, patron grants,
 * audit rows) is real.
 *
 *   set -a; . ~/.pp-test-db.env; set +a; export DATABASE_URL_UNPOOLED=$DATABASE_URL
 *   npx vitest run --config vitest.postgres.config.ts tests/postgres/payments.pg.test.ts
 */
import { PaymentStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const refundsCreate = vi.fn();
const refundsList = vi.fn();
/** Stripe's side of the refunds: PaymentIntent id -> refunds (list reads it; tests and refundsCreate write it). */
const stripeRefunds = new Map<string, Array<{ id: string; amount: number; status: string }>>();
const stripeSide = (intent: string) => {
  if (!stripeRefunds.has(intent)) stripeRefunds.set(intent, []);
  return stripeRefunds.get(intent)!;
};
vi.mock('@/lib/modules/email', () => ({
  sendBecomePatronEmail: vi.fn().mockResolvedValue(undefined),
  sendDonationThankYouEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/modules/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/notifications')>()),
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: () => ({ refunds: { create: refundsCreate, list: refundsList } }),
}));

import { createAppContext } from '@/lib/modules/shared/app-context';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { handleDispute } from '@/lib/modules/payments/application/handle-dispute.use-case';
import { syncRefundsFromStripe } from '@/lib/modules/payments/application/sync-refunds.use-case';
import { adminRefund } from '@/lib/modules/payments/application/admin-refund.use-case';
import { StripeEventLockService } from '@/lib/modules/payments/infrastructure/stripe-event-lock.service';

const prisma = new PrismaClient();
const RUN = `pg-pay-${Date.now().toString(36)}`;
const ctx = () => createAppContext({ actor: { type: 'system', reason: 'pg-test' }, prisma });
const adminCtx = () => createAppContext({ actor: { type: 'admin', userId: `${RUN}-admin` }, prisma });
const userId = `${RUN}-user`;
let seq = 0;

async function newPayment(overrides: Record<string, unknown> = {}) {
  const n = ++seq;
  return prisma.payment.create({
    data: { userId, amountMinor: 1000, currency: 'PLN', status: PaymentStatus.PENDING, stripeIntentId: `pi_${RUN}_${n}`, ...overrides },
  });
}
const fulfillInput = (p: { id: string; stripeIntentId: string | null }, extra = {}) => ({
  paymentId: p.id, stripeIntentId: p.stripeIntentId!, metadataUserId: userId, amountMinor: 1000, currency: 'pln', notifyPayer: false, ...extra,
});
const total = async () => (await prisma.userPaymentTotal.findUnique({ where: { userId_currency: { userId, currency: 'PLN' } } }))?.amountMinor ?? 0;
const activeGrants = () => prisma.patronGrant.count({ where: { userId, revokedAt: null } });

async function resetUser() {
  await prisma.patronGrant.deleteMany({ where: { userId } });
  await prisma.userPaymentTotal.deleteMany({ where: { userId } });
  await prisma.payment.deleteMany({ where: { userId } });
}

/** Default Stripe fakes: list reads stripeRefunds; create appends a succeeded refund. */
function resetStripeFakes() {
  stripeRefunds.clear();
  refundsList.mockReset().mockImplementation(async ({ payment_intent }: { payment_intent: string }) => ({ data: [...stripeSide(payment_intent)], has_more: false }));
  let n = 0;
  refundsCreate.mockReset().mockImplementation(async ({ payment_intent, amount }: { payment_intent: string; amount: number }) => {
    const refund = { id: `re_${RUN}_${++n}`, amount, status: 'succeeded' };
    stripeSide(payment_intent).push(refund);
    return refund;
  });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test`, name: RUN } });
});
afterAll(async () => {
  await resetUser();
  await prisma.stripeEvent.deleteMany({ where: { id: { startsWith: `evt_${RUN}` } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('fulfilment is exactly-once under concurrency', () => {
  it('five simultaneous fulfilments (webhook + fast path + cron) count the tip once', async () => {
    await resetUser();
    const payment = await newPayment();

    const results = await Promise.all(Array.from({ length: 5 }, () => fulfillPayment(fulfillInput(payment), ctx())));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.data.isFirstFulfillment)).toHaveLength(1);
    expect(await total()).toBe(1000);
    expect(await activeGrants()).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('SUCCEEDED');
  });

  it('refuses a mismatching amount and leaves the row PENDING', async () => {
    await resetUser();
    const payment = await newPayment();
    const result = await fulfillPayment(fulfillInput(payment, { amountMinor: 999 }), ctx());
    expect(result.ok).toBe(false);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
    expect(await total()).toBe(0);
  });
});

describe('refunds keep the per-user total and the status consistent', () => {
  it('partial then full refund, replays and a stale (smaller) event never move the total the wrong way', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());

    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 400 }, ctx());
    expect(await total()).toBe(600);
    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 400 }, ctx()); // replay
    expect(await total()).toBe(600);
    expect(await activeGrants()).toBe(1);

    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 1000 }, ctx());
    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 400 }, ctx()); // late, older event
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row).toMatchObject({ status: 'REFUNDED', refundedAmountMinor: 1000 });
    expect(await total()).toBe(0);
    expect(await activeGrants()).toBe(0);
  });

  it('concurrent identical refund events are applied once', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    await Promise.all(Array.from({ length: 4 }, () => handleRefund({ paymentId: payment.id, reportedRefundedMinor: 300 }, ctx())));
    expect(await total()).toBe(700);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).refundedAmountMinor).toBe(300);
  });

  it('a refund event for a payment not yet recorded as paid fails (retry) and does not touch another tip\'s total', async () => {
    await resetUser();
    const recorded = await newPayment();
    await fulfillPayment(fulfillInput(recorded), ctx());
    const early = await newPayment();

    const result = await handleRefund({ paymentId: early.id, reportedRefundedMinor: 1000 }, ctx());

    expect(result.ok).toBe(false);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: early.id } })).status).toBe('PENDING');
    expect(await total()).toBe(1000);
  });

  it('a dispute event for a payment not yet recorded as paid fails (retry) instead of being dropped', async () => {
    await resetUser();
    const early = await newPayment();
    const result = await handleDispute({ stripeIntentId: early.stripeIntentId!, disputeId: 'dp_x', status: 'needs_response' }, ctx());
    expect(result.ok).toBe(false);
  });

  it('a lost dispute removes the remaining net amount and the marker', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 250 }, ctx());

    await handleDispute({ stripeIntentId: payment.stripeIntentId!, disputeId: 'dp_1', status: 'lost' }, ctx());

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('CHARGEBACK_LOST');
    expect(await total()).toBe(0);
    expect(await activeGrants()).toBe(0);
  });
});

describe('admin refund against the real ledger (Stripe replaced)', () => {
  it('records the refund, the audit row and passes the dialog key to Stripe; the webhook echo of the same refund is a no-op', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    resetStripeFakes();

    const input = { paymentId: payment.id, amountMinor: 400, reason: 'test refund', idempotencyKey: `${RUN}-key-0000000000` };
    const first = await adminRefund(input, adminCtx());
    expect(first.ok).toBe(true);
    expect(refundsCreate.mock.calls[0][1]).toEqual({ idempotencyKey: `refund-${payment.id}-${input.idempotencyKey}` });

    // The charge.refunded webhook for the same refund arrives afterwards: no second decrement.
    await handleRefund({ paymentId: payment.id, reportedRefundedMinor: 400 }, ctx());
    expect(await total()).toBe(600);

    const audit = await prisma.auditLog.findMany({ where: { action: 'PAYMENT_REFUNDED', targetId: payment.id } });
    expect(audit).toHaveLength(1);
  });

  it('two simultaneous submits with different keys: Stripe is the limit and the local ledger converges to Stripe\'s total at once (PA-04)', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    resetStripeFakes();

    const results = await Promise.all([
      adminRefund({ paymentId: payment.id, amountMinor: 500, reason: 'a', idempotencyKey: `${RUN}-key-aaaaaaaaaaaa` }, adminCtx()),
      adminRefund({ paymentId: payment.id, amountMinor: 500, reason: 'b', idempotencyKey: `${RUN}-key-bbbbbbbbbbbb` }, adminCtx()),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(refundsCreate).toHaveBeenCalledTimes(2);

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row).toMatchObject({ status: 'REFUNDED', refundedAmountMinor: 1000 });
    expect(row.refundsCheckedAt).not.toBeNull();
    expect(await total()).toBe(0);
    expect(await activeGrants()).toBe(0);
  });

  it('writes the intent audit row before Stripe and the result row after; both carry the idempotency key (PA-09)', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    resetStripeFakes();

    await adminRefund({ paymentId: payment.id, amountMinor: 100, idempotencyKey: `${RUN}-key-cccccccccccc` }, adminCtx());

    const rows = await prisma.auditLog.findMany({ where: { targetId: payment.id, action: { in: ['PAYMENT_REFUND_REQUESTED', 'PAYMENT_REFUNDED'] } }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.action)).toEqual(['PAYMENT_REFUND_REQUESTED', 'PAYMENT_REFUNDED']);
    expect((rows[0].metadata as any).idempotencyKey).toBe(`refund-${payment.id}-${RUN}-key-cccccccccccc`);
    expect((rows[1].metadata as any)).toMatchObject({ totalRefundedMinor: 100, ledgerSynced: true });
  });
});

describe('refund ledger follows Stripe (PA-04)', () => {
  it('a refund made in the Dashboard is caught up with the person\'s total and marker', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    resetStripeFakes();
    stripeSide(payment.stripeIntentId!).push({ id: 're_dash', amount: 1000, status: 'succeeded' });

    const result = await syncRefundsFromStripe({ paymentId: payment.id }, ctx());

    expect(result.ok && result.data).toMatchObject({ matched: true, refundedMinor: 1000, deltaMinor: 1000 });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('REFUNDED');
    expect(await total()).toBe(0);
    expect(await activeGrants()).toBe(0);
  });

  it('a refund that failed afterwards gives the amount, the total and the marker back, and a repeat sync changes nothing more', async () => {
    await resetUser();
    const other = await newPayment();
    await fulfillPayment(fulfillInput(other), ctx());
    await prisma.patronGrant.deleteMany({ where: { userId } }); // so the marker below is the one under test
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    resetStripeFakes();
    stripeSide(payment.stripeIntentId!).push({ id: 're_blik', amount: 1000, status: 'pending' });
    await syncRefundsFromStripe({ paymentId: payment.id }, ctx());
    await handleRefund({ paymentId: other.id, reportedRefundedMinor: 1000 }, ctx());
    expect(await total()).toBe(0);

    stripeSide(payment.stripeIntentId!)[0].status = 'failed';
    const first = await syncRefundsFromStripe({ paymentId: payment.id }, ctx());
    const second = await syncRefundsFromStripe({ paymentId: payment.id }, ctx());

    expect(first.ok && first.data.deltaMinor).toBe(-1000);
    expect(second.ok && second.data.deltaMinor).toBe(0);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: 'SUCCEEDED', refundedAmountMinor: 0, refundedById: null });
    expect(await total()).toBe(1000);
  });

  it('a lost dispute keeps the total at zero when a refund on it fails afterwards', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    resetStripeFakes();
    stripeSide(payment.stripeIntentId!).push({ id: 're_1', amount: 250, status: 'succeeded' });
    await syncRefundsFromStripe({ paymentId: payment.id }, ctx());
    await handleDispute({ stripeIntentId: payment.stripeIntentId!, disputeId: 'dp_pa04', status: 'lost' }, ctx());
    expect(await total()).toBe(0);

    stripeSide(payment.stripeIntentId!)[0].status = 'failed';
    await syncRefundsFromStripe({ paymentId: payment.id }, ctx());

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('CHARGEBACK_LOST');
    expect(await total()).toBe(0);
  });

  it('concurrent syncs are serialized by the row lock: each reads Stripe after the previous one committed, the last Stripe answer wins', async () => {
    await resetUser();
    const payment = await newPayment();
    await fulfillPayment(fulfillInput(payment), ctx());
    resetStripeFakes();
    stripeSide(payment.stripeIntentId!).push({ id: 're_1', amount: 600, status: 'succeeded' });

    // The first list call is slow and answers with the OLD state (600); meanwhile Stripe moves on to 1000.
    let calls = 0;
    refundsList.mockImplementation(async ({ payment_intent }: { payment_intent: string }) => {
      const snapshot = [...stripeSide(payment_intent)];
      if (++calls === 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        stripeSide(payment_intent).push({ id: 're_2', amount: 400, status: 'succeeded' });
      }
      return { data: snapshot, has_more: false };
    });
    const [a, b] = await Promise.all([
      syncRefundsFromStripe({ paymentId: payment.id }, ctx()),
      (async () => { await new Promise((resolve) => setTimeout(resolve, 30)); return syncRefundsFromStripe({ paymentId: payment.id }, ctx()); })(),
    ]);

    expect(a.ok && b.ok).toBe(true);
    // Without the lock the 2nd sync (fresh answer 1000) could be overwritten by the 1st (stale 600).
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: 'REFUNDED', refundedAmountMinor: 1000 });
    expect(await total()).toBe(0);
  });
});

describe('StripeEvent lock', () => {
  it('only one of several simultaneous deliveries of the same event acquires it; PROCESSED is acknowledged as duplicate; FAILED can be retaken', async () => {
    const id = `evt_${RUN}_lock`;
    const lock = new StripeEventLockService({ read: prisma, write: prisma });
    const results = await Promise.all(Array.from({ length: 6 }, () => lock.acquireLock({ id, type: 'payment_intent.succeeded', payload: {} })));
    expect(results.filter((r) => r === 'ACQUIRED')).toHaveLength(1);
    expect(results.filter((r) => r === 'CONFLICT')).toHaveLength(5);

    await lock.releaseWithFailure(id, 'boom');
    expect(await lock.acquireLock({ id, type: 'payment_intent.succeeded', payload: {} })).toBe('ACQUIRED');
    await lock.releaseWithSuccess(id);
    expect(await lock.acquireLock({ id, type: 'payment_intent.succeeded', payload: {} })).toBe('ALREADY_PROCESSED');
  });
});
