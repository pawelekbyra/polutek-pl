/**
 * How fulfillPayment() triggers the Premium "Potwierdzenie zakupu" mail: after the commit, for the first fulfilment of a
 * Premium payment (whatever `notifyPayer` says), again only as a no-cost replay, and never for a tip (which keeps its
 * thank-you e-mail) or for a payment that fails validation. The mail itself is covered by send-purchase-confirmation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
const sendBecomePatronEmail = vi.fn();
const sendDonationThankYouEmail = vi.fn();
const ensurePurchaseConfirmation = vi.fn();
const grantPatronAccessForPayment = vi.fn();

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
vi.mock('@/lib/modules/patron-zone', () => ({
  grantPatronAccessForPayment: (...args: unknown[]) => grantPatronAccessForPayment(...args),
  readPaymentConsents: () => null,
  readPaymentProductId: () => 'ACCESS_30D',
}));
vi.mock('@/lib/modules/payments/application/send-purchase-confirmation.use-case', () => ({
  ensurePurchaseConfirmation: (...args: unknown[]) => ensurePurchaseConfirmation(...args),
}));

const { fulfillPayment } = await import('@/lib/modules/payments/application/fulfill-payment.use-case');
const ctx = () => createTestContext(db);

function seed(overrides: Record<string, unknown> = {}) {
  const row = {
    id: `pay_${db.payment.rows.length + 1}`,
    userId: 'user_1',
    amountMinor: 1499,
    currency: 'PLN',
    status: 'PENDING',
    stripeIntentId: `pi_${db.payment.rows.length + 1}`,
    refundedAmountMinor: 0,
    metadata: { purpose: 'premium_pass', productId: 'ACCESS_30D' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  db.payment.rows.push(row);
  return row;
}
const input = (payment: any, overrides: Record<string, unknown> = {}) => ({
  paymentId: payment.id, stripeIntentId: payment.stripeIntentId, metadataUserId: 'user_1',
  amountMinor: payment.amountMinor, currency: payment.currency.toLowerCase(), ...overrides,
});

beforeEach(() => {
  for (const name of ['payment', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl' });
  vi.clearAllMocks();
  ensurePurchaseConfirmation.mockResolvedValue({ status: 'sent' });
  grantPatronAccessForPayment.mockResolvedValue({ granted: true });
});

describe('fulfillPayment and the purchase confirmation', () => {
  it('first fulfilment of a Premium payment: one confirmation, no tip thank-you, no supporter marker', async () => {
    const payment = seed();

    const result = await fulfillPayment(input(payment), ctx());

    expect(result.ok && result.data.isFirstFulfillment).toBe(true);
    expect(payment.status).toBe('SUCCEEDED');
    expect(ensurePurchaseConfirmation).toHaveBeenCalledTimes(1);
    expect(ensurePurchaseConfirmation.mock.calls[0][0]).toEqual({ paymentId: payment.id });
    expect(sendBecomePatronEmail).not.toHaveBeenCalled();
    expect(sendDonationThankYouEmail).not.toHaveBeenCalled();
    expect(db.patronGrant.rows).toHaveLength(0);
  });

  it('notifyPayer=false (an old payment recovered late) still owes the confirmation', async () => {
    const payment = seed();
    await fulfillPayment(input(payment, { notifyPayer: false }), ctx());
    expect(ensurePurchaseConfirmation).toHaveBeenCalledTimes(1);
  });

  it('a replay of an already recorded Premium payment asks again (the guard makes it a no-op once sent)', async () => {
    const payment = seed();
    await fulfillPayment(input(payment), ctx());
    ensurePurchaseConfirmation.mockClear();

    const replay = await fulfillPayment(input(payment), ctx());

    expect(replay.ok && replay.data.isFirstFulfillment).toBe(false);
    expect(ensurePurchaseConfirmation).toHaveBeenCalledTimes(1);
    expect(grantPatronAccessForPayment).toHaveBeenCalledTimes(1); // access still granted once
  });

  it('a tip keeps its thank-you and gets no purchase confirmation, also on a replay', async () => {
    const tip = seed({ metadata: null });
    await fulfillPayment(input(tip), ctx());
    await fulfillPayment(input(tip), ctx());
    expect(sendBecomePatronEmail).toHaveBeenCalledTimes(1);
    expect(ensurePurchaseConfirmation).not.toHaveBeenCalled();
  });

  it('a payment that fails validation (wrong amount) sends nothing', async () => {
    const payment = seed();
    const result = await fulfillPayment(input(payment, { amountMinor: 1 }), ctx());
    expect(result.ok).toBe(false);
    expect(payment.status).toBe('PENDING');
    expect(ensurePurchaseConfirmation).not.toHaveBeenCalled();
  });

  it('a confirmation that fails or throws never turns a recorded payment into a failure', async () => {
    for (const outcome of [() => Promise.resolve({ status: 'failed', error: 'provider down' }), () => Promise.reject(new Error('boom'))]) {
      ensurePurchaseConfirmation.mockImplementation(outcome);
      const payment = seed();
      const result = await fulfillPayment(input(payment), ctx());
      expect(result.ok && result.data.isFirstFulfillment).toBe(true);
      expect(payment.status).toBe('SUCCEEDED');
    }
  });
});
