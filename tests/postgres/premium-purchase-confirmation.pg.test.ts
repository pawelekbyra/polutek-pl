/**
 * The Premium "Potwierdzenie zakupu" mail on a real Postgres: the unit tests use an in-memory marker store, so only a
 * real database can prove that the single atomic UPDATE (Payment.metadata.purchaseConfirmation) keeps the mail to one
 * per payment under concurrency, keeps the other metadata, honours the retry pause / attempt limit and refuses a payment
 * that is no longer SUCCEEDED. The transport is a spy (no mail leaves); the Stripe API is never called.
 *
 *   set -a; . ~/.pp-test-db.env; set +a; export DATABASE_URL_UNPOOLED=$DATABASE_URL
 *   npx vitest run --config vitest.postgres.config.ts tests/postgres/premium-purchase-confirmation.pg.test.ts
 */
import { PaymentStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn();
vi.mock('@/lib/modules/email/infrastructure/resend-email.transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/email/infrastructure/resend-email.transport')>()),
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));
vi.mock('@/lib/modules/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/notifications')>()),
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

import { createAppContext } from '@/lib/modules/shared/app-context';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { ensurePurchaseConfirmation } from '@/lib/modules/payments/application/send-purchase-confirmation.use-case';
import { CONFIRMATION_MAX_ATTEMPTS, readConfirmationMarker } from '@/lib/modules/payments/infrastructure/purchase-confirmation.store';
import { viewerPassState } from '@/lib/modules/patron-zone';

const prisma = new PrismaClient();
const RUN = `pg-pconf-${Date.now().toString(36)}`;
const payer = `${RUN}-payer`;
const plPayer = `${RUN}-pl`;
const PRICE = 1499;
const WAIVER_AT = '2026-11-26T09:28:00.000Z';
let seq = 0;

const ctx = () => createAppContext({ actor: { type: 'system', reason: 'pg-test' }, prisma });

async function premiumPayment(overrides: { userId?: string; status?: PaymentStatus; metadata?: Record<string, unknown> | null } = {}) {
  const n = ++seq;
  return prisma.payment.create({
    data: {
      userId: overrides.userId ?? payer, amountMinor: PRICE, currency: 'PLN', status: overrides.status ?? PaymentStatus.PENDING,
      stripeIntentId: `pi_${RUN}_${n}`,
      metadata: (overrides.metadata === undefined
        ? { purpose: 'premium_pass', productId: 'ACCESS_30D', consents: { termsVersion: 'test-v1', waiverAt: WAIVER_AT } }
        : overrides.metadata) as never,
    },
  });
}

const fulfil = (p: { id: string; stripeIntentId: string | null; userId: string }) => fulfillPayment({
  paymentId: p.id, stripeIntentId: p.stripeIntentId!, metadataUserId: p.userId, amountMinor: PRICE, currency: 'pln', notifyPayer: false,
}, ctx());

const marker = async (id: string) => readConfirmationMarker((await prisma.payment.findUniqueOrThrow({ where: { id } })).metadata);
const setMarker = (id: string, value: Record<string, unknown>) => prisma.payment.update({
  where: { id },
  data: { metadata: { purpose: 'premium_pass', productId: 'ACCESS_30D', purchaseConfirmation: value } as never },
});
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

async function reset() {
  // AuditLog rows are append-only (the database refuses to delete them): assertions below look at one payment id each.
  for (const userId of [payer, plPayer]) {
    await prisma.patronGrant.deleteMany({ where: { userId } });
    await prisma.userPaymentTotal.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.appSetting.deleteMany({ where: { key: `xp.premium_pass:${userId}` } });
  }
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: 'm1' });
}

beforeAll(async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_pg_confirmation');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.pawelperfect.com');
  await prisma.user.createMany({ data: [
    { id: payer, email: `${payer}@example.test`, name: payer, language: 'en' },
    { id: plPayer, email: `${plPayer}@example.test`, name: plPayer, language: 'pl' },
  ] });
});
beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.user.deleteMany({ where: { id: { in: [payer, plPayer] } } });
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

describe('Premium purchase confirmation through fulfillPayment', () => {
  it('one confirmation per payment: first fulfilment sends, replays and parallel events do not', async () => {
    const payment = await premiumPayment({ userId: plPayer });

    const results = await Promise.all(Array.from({ length: 8 }, () => fulfil(payment)));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.data.isFirstFulfillment)).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail).toMatchObject({ to: `${plPayer}@example.test`, language: 'pl', kind: 'purchase-confirmation', idempotencyKey: `purchase-confirmation-${payment.id}` });
    expect(mail.subject).toBe('Potwierdzenie zakupu: Dostęp Premium na 30 dni');
    expect(mail.html).toContain(payment.id);
    expect(mail.html).toContain('14,99');
    expect(mail.html).toContain('regulamin-premium');
    expect(mail.html).toContain('wyraźną zgodę');

    await fulfil(payment);
    await fulfil(payment);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    expect(await marker(payment.id)).toMatchObject({ state: 'sent', attempts: 1 });
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row.status).toBe(PaymentStatus.SUCCEEDED);
    // The other payment metadata survived the marker updates.
    expect(row.metadata).toMatchObject({ purpose: 'premium_pass', productId: 'ACCESS_30D', consents: { termsVersion: 'test-v1', waiverAt: WAIVER_AT } });
    // Access was granted by the same fulfilment; a Premium payment gets no tip e-mails.
    expect((await viewerPassState(createAppContext({ actor: { type: 'user', userId: plPayer }, prisma }), new Date())).state).toBe('active');
    expect(await prisma.patronGrant.count({ where: { userId: plPayer } })).toBe(0);
  });

  it('an English account gets the English mail', async () => {
    const payment = await premiumPayment({ metadata: { purpose: 'premium_pass', productId: 'ACCESS_LIFETIME', consents: { termsVersion: 'v', waiverAt: WAIVER_AT } } });
    await prisma.payment.update({ where: { id: payment.id }, data: { amountMinor: 2999 } });
    await fulfillPayment({ paymentId: payment.id, stripeIntentId: payment.stripeIntentId!, metadataUserId: payer, amountMinor: 2999, currency: 'pln' }, ctx());
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ language: 'en', subject: 'Purchase confirmation: Premium access for 3 months' });
  });

  it('a tip is not confirmed with this mail', async () => {
    const tip = await premiumPayment({ metadata: null });
    await fulfil(tip);
    expect(sendEmail).not.toHaveBeenCalled();
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: tip.id } })).metadata).toBeNull();
  });

  it('Stripe test keys: [TEST] subject and banner; the premium key set is judged by its own key', async () => {
    vi.stubEnv('PREMIUM_PASS_STRIPE_SECRET_KEY', 'sk_test_pg_premium_confirmation');
    const payment = await premiumPayment({ userId: plPayer, metadata: { purpose: 'premium_pass', productId: 'ACCESS_30D', stripeKeySet: 'premium', consents: { termsVersion: 'v', waiverAt: WAIVER_AT } } });
    await fulfil(payment);
    expect(sendEmail.mock.calls[0][0].subject.startsWith('[TEST] ')).toBe(true);
    expect(sendEmail.mock.calls[0][0].html).toContain('zamówienie testowe');

    const live = await premiumPayment();
    await fulfil(live);
    expect(sendEmail.mock.calls[1][0].subject.startsWith('[TEST]')).toBe(false);
    vi.stubEnv('PREMIUM_PASS_STRIPE_SECRET_KEY', '');
  });

  it('a failed send never breaks the payment: recorded, audited, retried by a later event only after the pause', async () => {
    sendEmail.mockResolvedValue({ ok: false, error: { name: 'rate_limit', message: 'provider down', statusCode: 429 } });
    const payment = await premiumPayment();

    const first = await fulfil(payment);

    expect(first.ok && first.data.isFirstFulfillment).toBe(true);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(PaymentStatus.SUCCEEDED);
    expect(await marker(payment.id)).toMatchObject({ state: 'failed', attempts: 1, error: 'provider down' });
    expect(await prisma.auditLog.count({ where: { action: 'EMAIL_SEND_FAILED', targetId: payment.id } })).toBe(1);

    await fulfil(payment); // replay straight away: inside the pause, nothing is sent
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // The pause is over (the marker is moved back in time): the next replay delivers it, once.
    await prisma.$executeRaw`UPDATE "Payment" SET "metadata" = jsonb_set("metadata", '{purchaseConfirmation,at}', to_jsonb(${minutesAgo(20)}::text)) WHERE "id" = ${payment.id}`;
    sendEmail.mockResolvedValue({ ok: true, id: 'm2' });
    await Promise.all([fulfil(payment), fulfil(payment), fulfil(payment)]);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const done = await marker(payment.id);
    expect(done).toMatchObject({ state: 'sent', attempts: 2 });
    expect(done).not.toHaveProperty('error');
    await fulfil(payment);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});

describe('the atomic claim (ensurePurchaseConfirmation on a recorded payment)', () => {
  it('many parallel callers: exactly one send', async () => {
    const payment = await premiumPayment({ status: PaymentStatus.SUCCEEDED });
    const outcomes = await Promise.all(Array.from({ length: 12 }, () => ensurePurchaseConfirmation({ paymentId: payment.id }, ctx())));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(outcomes.filter((o) => o.status === 'sent')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'skipped')).toHaveLength(11);
  });

  it('a payment that is not SUCCEEDED any more gets nothing and is not marked', async () => {
    for (const status of [PaymentStatus.PENDING, PaymentStatus.REFUNDED, PaymentStatus.DISPUTED, PaymentStatus.CHARGEBACK_LOST]) {
      const payment = await premiumPayment({ status });
      expect(await ensurePurchaseConfirmation({ paymentId: payment.id }, ctx())).toMatchObject({ status: 'skipped', reason: 'not_paid' });
      expect(await marker(payment.id)).toBeNull();
    }
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('gives up after the attempt limit', async () => {
    const payment = await premiumPayment({ status: PaymentStatus.SUCCEEDED });
    await setMarker(payment.id, { state: 'failed', attempts: CONFIRMATION_MAX_ATTEMPTS, at: minutesAgo(120), paidAt: minutesAgo(200), error: 'x' });
    expect(await ensurePurchaseConfirmation({ paymentId: payment.id }, ctx())).toEqual({ status: 'skipped', reason: 'exhausted' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('a `sending` claim is respected while fresh and taken over once stale (attempt counted, first date kept)', async () => {
    const payment = await premiumPayment({ status: PaymentStatus.SUCCEEDED });
    const paidAt = minutesAgo(90);
    await setMarker(payment.id, { state: 'sending', attempts: 1, at: minutesAgo(1), paidAt });
    expect(await ensurePurchaseConfirmation({ paymentId: payment.id }, ctx())).toEqual({ status: 'skipped', reason: 'busy' });
    expect(sendEmail).not.toHaveBeenCalled();

    await setMarker(payment.id, { state: 'sending', attempts: 1, at: minutesAgo(30), paidAt });
    expect(await ensurePurchaseConfirmation({ paymentId: payment.id }, ctx())).toEqual({ status: 'sent' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await marker(payment.id)).toMatchObject({ state: 'sent', attempts: 2, paidAt });
  });

  it('a sent confirmation is final', async () => {
    const payment = await premiumPayment({ status: PaymentStatus.SUCCEEDED });
    await setMarker(payment.id, { state: 'sent', attempts: 1, at: minutesAgo(600), paidAt: minutesAgo(601), sentAt: minutesAgo(600) });
    expect(await ensurePurchaseConfirmation({ paymentId: payment.id }, ctx())).toEqual({ status: 'skipped', reason: 'already_sent' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
