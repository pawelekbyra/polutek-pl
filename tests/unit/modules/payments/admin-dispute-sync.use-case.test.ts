import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
const chargesList = vi.fn();
const disputesList = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({
  getStripeClient: () => ({ charges: { list: chargesList }, disputes: { list: disputesList } }),
}));

const { adminDisputeSync } = await import('@/lib/modules/payments/application/admin-dispute-sync.use-case');

const adminCtx = () => createTestContext(db, { type: 'admin', userId: 'admin_1' });

function seed(status: string) {
  const row = {
    id: 'pay_1', userId: 'user_1', creatorId: 'c', amountMinor: 1000, refundedAmountMinor: 0, currency: 'PLN',
    status, stripeIntentId: 'pi_1', createdAt: new Date(), updatedAt: new Date(),
  };
  db.payment.rows.push(row);
  return row;
}

function stripeDispute(status: string) {
  chargesList.mockResolvedValue({ data: [{ id: 'ch_1' }] });
  disputesList.mockResolvedValue({ data: [{ id: 'dp_1', status }] });
}

beforeEach(() => {
  for (const name of ['payment', 'patronGrant', 'user', 'userPaymentTotal']) db[name].rows.length = 0;
  db.user.rows.push({ id: 'user_1', email: 'payer@example.com', language: 'pl' });
  vi.clearAllMocks();
});

describe('adminDisputeSync', () => {
  it('404 for an unknown payment', async () => {
    const result = await adminDisputeSync({ paymentId: 'missing' }, adminCtx());
    expect(!result.ok && result.error.statusCode).toBe(404);
  });

  it('reports "no dispute" without changing anything', async () => {
    const payment = seed('SUCCEEDED');
    chargesList.mockResolvedValue({ data: [{ id: 'ch_1' }] });
    disputesList.mockResolvedValue({ data: [] });

    const result = await adminDisputeSync({ paymentId: 'pay_1' }, adminCtx());

    expect(result.ok && result.data.synced).toBe(false);
    expect(payment.status).toBe('SUCCEEDED');
  });

  it('an open dispute marks the payment DISPUTED', async () => {
    const payment = seed('SUCCEEDED');
    stripeDispute('needs_response');
    await adminDisputeSync({ paymentId: 'pay_1' }, adminCtx());
    expect(payment.status).toBe('DISPUTED');
  });

  it('a closed inquiry (warning_closed) restores a disputed payment instead of re-opening it (PAY-10)', async () => {
    const payment = seed('DISPUTED');
    stripeDispute('warning_closed');
    const result = await adminDisputeSync({ paymentId: 'pay_1' }, adminCtx());
    expect(result.ok && result.data.disputeStatus).toBe('warning_closed');
    expect(payment.status).toBe('SUCCEEDED');
  });

  it('a lost dispute is final', async () => {
    const payment = seed('DISPUTED');
    stripeDispute('lost');
    await adminDisputeSync({ paymentId: 'pay_1' }, adminCtx());
    expect(payment.status).toBe('CHARGEBACK_LOST');
  });

  it('a Stripe failure is a 502 without the Stripe message', async () => {
    seed('SUCCEEDED');
    chargesList.mockRejectedValue(new Error('rate_limited'));
    const result = await adminDisputeSync({ paymentId: 'pay_1' }, adminCtx());
    expect(!result.ok && result.error.statusCode).toBe(502);
    expect(!result.ok && result.error.message).not.toContain('rate_limited');
  });
});
