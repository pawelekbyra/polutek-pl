import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
const sendBecomePatronEmail = vi.fn();
const sendDonationThankYouEmail = vi.fn();
const sendNotification = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args) }));
vi.mock('@/lib/modules/email', () => ({
  sendBecomePatronEmail: (...args: unknown[]) => sendBecomePatronEmail(...args),
  sendDonationThankYouEmail: (...args: unknown[]) => sendDonationThankYouEmail(...args),
}));
vi.mock('@/lib/modules/notifications', () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
  notificationTemplates: { supportThanks: { kind: 'PATRON', titlePl: 't', titleEn: 't', bodyPl: 'b', bodyEn: 'b' } },
}));

const { fulfillPayment } = await import('@/lib/modules/payments/application/fulfill-payment.use-case');

const ctx = () => createTestContext(db);

function seed(overrides: Record<string, unknown> = {}) {
  const row = {
    id: `pay_${db.payment.rows.length + 1}`,
    userId: 'user_1',
    creatorId: 'creator_1',
    amountMinor: 1000,
    currency: 'PLN',
    status: 'PENDING',
    stripeIntentId: `pi_${db.payment.rows.length + 1}`,
    refundedAmountMinor: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  db.payment.rows.push(row);
  return row;
}

const input = (payment: any, overrides: Record<string, unknown> = {}) => ({
  paymentId: payment.id,
  stripeIntentId: payment.stripeIntentId,
  metadataUserId: 'user_1',
  amountMinor: payment.amountMinor,
  currency: payment.currency.toLowerCase(),
  ...overrides,
});

beforeEach(() => {
  for (const name of ['payment', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'en' });
  vi.clearAllMocks();
});

describe('fulfillPayment', () => {
  it('first tip: SUCCEEDED, supporter marker, totals, one "become patron" e-mail and notification', async () => {
    const payment = seed();

    const result = await fulfillPayment(input(payment), ctx());

    expect(result.ok && result.data.isFirstFulfillment).toBe(true);
    expect(payment.status).toBe('SUCCEEDED');
    expect(db.patronGrant.rows).toHaveLength(1);
    expect(db.userPaymentTotal.rows[0]).toMatchObject({ userId: 'user_1', currency: 'PLN', amountMinor: 1000 });
    expect(sendBecomePatronEmail).toHaveBeenCalledWith('payer@example.com', 10, 'PLN', 'en');
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it('a later tip adds no second marker and sends the plain thank-you', async () => {
    await fulfillPayment(input(seed()), ctx());
    vi.clearAllMocks();

    await fulfillPayment(input(seed({ amountMinor: 300 }), { amountMinor: 300 }), ctx());

    expect(db.patronGrant.rows).toHaveLength(1);
    expect(sendDonationThankYouEmail).toHaveBeenCalledTimes(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('a replay changes nothing and thanks nobody again', async () => {
    const payment = seed();
    await fulfillPayment(input(payment), ctx());
    vi.clearAllMocks();

    const replay = await fulfillPayment(input(payment), ctx());

    expect(replay.ok && replay.data.isFirstFulfillment).toBe(false);
    expect(db.userPaymentTotal.rows[0].amountMinor).toBe(1000);
    expect(sendBecomePatronEmail).not.toHaveBeenCalled();
    expect(sendDonationThankYouEmail).not.toHaveBeenCalled();
  });

  it('records the intent id when the checkout write of it was lost', async () => {
    const payment = seed({ stripeIntentId: null });
    await fulfillPayment(input(payment, { stripeIntentId: 'pi_recovered' }), ctx());
    expect(payment).toMatchObject({ status: 'SUCCEEDED', stripeIntentId: 'pi_recovered' });
  });

  it.each([
    ['amount', { amountMinor: 999 }, 'PAYMENT_AMOUNT_MISMATCH'],
    ['currency', { currency: 'eur' }, 'PAYMENT_CURRENCY_MISMATCH'],
    ['intent', { stripeIntentId: 'pi_other' }, 'PAYMENT_STRIPE_INTENT_MISMATCH'],
    ['user', { metadataUserId: 'user_2' }, 'PAYMENT_METADATA_USER_MISMATCH'],
  ])('refuses a %s that does not match the local payment', async (_label, overrides, code) => {
    const payment = seed();
    const result = await fulfillPayment(input(payment, overrides), ctx());
    expect(!result.ok && result.error.message).toContain(code);
    expect(payment.status).toBe('PENDING');
    expect(db.patronGrant.rows).toHaveLength(0);
  });

  it('a failing e-mail never undoes the recorded payment (it is audited instead)', async () => {
    const payment = seed();
    sendBecomePatronEmail.mockRejectedValueOnce(new Error('resend down'));

    const result = await fulfillPayment(input(payment), ctx());

    expect(result.ok).toBe(true);
    expect(payment.status).toBe('SUCCEEDED');
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'EMAIL_SEND_FAILED' }));
  });

  it('notifyPayer=false records the payment silently', async () => {
    const payment = seed();
    await fulfillPayment({ ...input(payment), notifyPayer: false }, ctx());
    expect(payment.status).toBe('SUCCEEDED');
    expect(sendBecomePatronEmail).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
