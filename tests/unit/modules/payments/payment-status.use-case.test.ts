import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
const retrieve = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/lib/modules/email', () => ({ sendBecomePatronEmail: vi.fn(), sendDonationThankYouEmail: vi.fn() }));
vi.mock('@/lib/modules/notifications', () => ({
  sendNotification: vi.fn(),
  notificationTemplates: { supportThanks: { kind: 'PATRON', titlePl: 't', titleEn: 't', bodyPl: 'b', bodyEn: 'b' } },
}));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: () => ({ paymentIntents: { retrieve } }),
}));

const { getOwnedPaymentStatus } = await import('@/lib/modules/payments/application/get-payment-status.use-case');

function seed(status: string) {
  const row = {
    id: 'pay_1',
    userId: 'user_1',
    creatorId: 'creator_1',
    amountMinor: 1000,
    currency: 'PLN',
    status,
    stripeIntentId: 'pi_1',
    refundedAmountMinor: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.payment.rows.push(row);
  return row;
}

const ctx = () => createTestContext(db, { type: 'user', userId: 'user_1' });

beforeEach(() => {
  for (const name of ['payment', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl' });
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
});

describe('getOwnedPaymentStatus', () => {
  it('returns null for somebody else\'s payment without asking Stripe', async () => {
    seed('PENDING');
    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_2' }, ctx());
    expect(result.ok && result.data).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('fast path: records a pending payment Stripe already reports as succeeded', async () => {
    const payment = seed('PENDING');
    retrieve.mockResolvedValue({ id: 'pi_1', status: 'succeeded', amount: 1000, currency: 'pln', metadata: { userId: 'user_1' } });

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx());

    expect(payment.status).toBe('SUCCEEDED');
    expect(result.ok && result.data?.uiStatus).toBe('SUCCEEDED');
  });

  it('a payment wrongly marked FAILED is re-checked and shown as succeeded (PAY-01)', async () => {
    seed('FAILED');
    retrieve.mockResolvedValue({ id: 'pi_1', status: 'succeeded', amount: 1000, currency: 'pln', metadata: { userId: 'user_1' } });

    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx());

    expect(result.ok && result.data?.uiStatus).toBe('SUCCEEDED');
  });

  it('a succeeded tip is SUCCEEDED even when the user already was a supporter (no "access" state, PAY-29)', async () => {
    seed('SUCCEEDED');
    const result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx());
    expect(result.ok && result.data?.uiStatus).toBe('SUCCEEDED');
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('still waiting at Stripe → PROCESSING; refunded → REFUNDED', async () => {
    const payment = seed('PENDING');
    retrieve.mockResolvedValue({ id: 'pi_1', status: 'processing' });
    let result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx());
    expect(result.ok && result.data?.uiStatus).toBe('PROCESSING');

    payment.status = 'PARTIALLY_REFUNDED';
    result = await getOwnedPaymentStatus({ paymentId: 'pay_1', userId: 'user_1' }, ctx());
    expect(result.ok && result.data?.uiStatus).toBe('REFUNDED');
  });
});
