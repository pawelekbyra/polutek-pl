import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { grantPatron, getPatronStatus, revokePatron } from '@/lib/modules/patron';
import { PaymentStatus, PatronGrantSource } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/logger');
vi.mock('@/lib/observability');
vi.mock('@/lib/modules/email/application/send-transactional-email.use-case');
vi.mock('@/lib/modules/users/application/sync-clerk-access');
vi.mock('@/lib/modules/audit');

// Mock getPaymentCurrencyLimits to control thresholds for smoke test
vi.mock('@/lib/payments/currency-settings', () => ({
  getPaymentCurrencyLimits: vi.fn().mockResolvedValue({
    PLN: { minAmountMinor: 1000, patronThresholdMinor: 1000, patronBoxMinMinor: 1000 }, // 10 PLN
  }),
  resolvePatronThresholdMinor: (_currency: string, fallbackMinor: number) => fallbackMinor,
}));

describe('Payment to PatronGrant Smoke Test', () => {
  let mockPrisma: any;
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock database state
    const dbState = {
      users: new Map<string, any>(),
      payments: new Map<string, any>(),
      grants: [] as any[],
      totals: new Map<string, any>(),
      auditLogs: [] as any[],
    };

    mockPrisma = {
      payment: {
        updateMany: vi.fn(async ({ where, data }) => {
            const p = dbState.payments.get(where.id);
            if (p && p.status === where.status) {
                p.status = data.status;
                return { count: 1 };
            }
            return { count: 0 };
        }),
        findUnique: vi.fn(async ({ where }) => {
            if (where.stripeIntentId) {
                return Array.from(dbState.payments.values()).find(p => p.stripeIntentId === where.stripeIntentId);
            }
            return dbState.payments.get(where.id);
        }),
        findFirst: vi.fn(async () => null),
      },
      user: {
        findUnique: vi.fn(async ({ where }) => {
            const u = dbState.users.get(where.id);
            if (!u) return null;
            return {
                ...u,
                paymentTotals: Array.from(dbState.totals.values()).filter(t => t.userId === u.id),
                patronGrants: dbState.grants.filter(g => g.userId === u.id && g.revokedAt === null).slice(0, 1)
            };
        }),
        update: vi.fn(async ({ where, data }) => {
            const u = dbState.users.get(where.id);
            if (u) {
                Object.assign(u, data);
                return {
                    ...u,
                    paymentTotals: Array.from(dbState.totals.values()).filter(t => t.userId === u.id),
                    patronGrants: dbState.grants.filter(g => g.userId === u.id && g.revokedAt === null).slice(0, 1)
                };
            }
        }),
      },
      userPaymentTotal: {
        upsert: vi.fn(async ({ where, update, create }) => {
            const key = `${where.userId_currency.userId}_${where.userId_currency.currency}`;
            let t = dbState.totals.get(key);
            if (t) {
                t.amountMinor += update.amountMinor.increment;
            } else {
                t = { ...create };
                dbState.totals.set(key, t);
            }
            return t;
        }),
      },
      patronGrant: {
        create: vi.fn(async ({ data }) => {
            const g = { ...data, id: `g_${dbState.grants.length + 1}`, createdAt: new Date(), revokedAt: null };
            dbState.grants.push(g);
            return g;
        }),
        findUnique: vi.fn(async ({ where }) => dbState.grants.find(g => g.paymentId === where.paymentId)),
        findFirst: vi.fn(async ({ where }) => dbState.grants.find(g => g.userId === where.userId && g.revokedAt === null)),
        findMany: vi.fn(async ({ where }) => dbState.grants.filter(g => g.userId === where.userId && (where.revokedAt === null ? g.revokedAt === null : true))),
        updateMany: vi.fn(async ({ where, data }) => {
            let count = 0;
            dbState.grants.forEach(g => {
                if (g.userId === where.userId && g.revokedAt === null) {
                    Object.assign(g, data);
                    count++;
                }
            });
            return { count };
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }) => {
          const log = { ...data, id: `log_${dbState.auditLogs.length + 1}`, createdAt: new Date() };
          dbState.auditLogs.push(log);
          return log;
        }),
      },
      $transaction: vi.fn(async (fn) => await fn(mockPrisma)),
      $executeRaw: vi.fn(),
    };

    ctx = {
      db: {
        writeTransaction: async (fn: any) => await mockPrisma.$transaction(fn),
        read: mockPrisma,
      },
      actor: { type: 'system' },
      prisma: mockPrisma,
    };

    // Initialize state
    dbState.users.set('u1', { id: 'u1', email: 'u1@example.com', language: 'pl' });
    dbState.payments.set('pay_qualifying', { id: 'pay_qualifying', userId: 'u1', amountMinor: 1000, currency: 'PLN', status: PaymentStatus.PENDING });
    dbState.payments.set('pay_under', { id: 'pay_under', userId: 'u1', amountMinor: 500, currency: 'PLN', status: PaymentStatus.PENDING });
  });

  it('SMOKE: qualifying payment results in active PatronGrant', async () => {
    // 1. Fulfill qualifying payment
    const result = await fulfillPayment({
      paymentId: 'pay_qualifying',
      userId: 'u1',
      amountMinor: 1000,
      currency: 'PLN',
    }, ctx);

    expect(result.ok).toBe(true);

    // 2. Verify access truth (getPatronStatus)
    const status = await getPatronStatus('u1', ctx);
    expect(status.ok).toBe(true);
    if (status.ok) {
        expect(status.data.activeGrants).toHaveLength(1);
        expect(status.data.activeGrants[0].paymentId).toBe('pay_qualifying');
        expect(status.data.isPatron).toBe(true);
    }
  });

  it('SMOKE: under-threshold payment does NOT result in PatronGrant', async () => {
    // 1. Fulfill under-threshold payment
    const result = await fulfillPayment({
      paymentId: 'pay_under',
      userId: 'u1',
      amountMinor: 500,
      currency: 'PLN',
    }, ctx);

    expect(result.ok).toBe(true);

    // 2. Verify access truth (getPatronStatus)
    const status = await getPatronStatus('u1', ctx);
    expect(status.ok).toBe(true);
    if (status.ok) {
        expect(status.data.activeGrants).toHaveLength(0);
        expect(status.data.isPatron).toBe(false);
    }
  });

  it('SMOKE: replayed payment is idempotent and does not duplicate grants', async () => {
    // 1. Fulfill first time
    await fulfillPayment({
      paymentId: 'pay_qualifying',
      userId: 'u1',
      amountMinor: 1000,
      currency: 'PLN',
    }, ctx);

    // 2. Fulfill second time (replay)
    const result = await fulfillPayment({
      paymentId: 'pay_qualifying',
      userId: 'u1',
      amountMinor: 1000,
      currency: 'PLN',
    }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.isFirstFulfillment).toBe(false);
    }

    // 3. Verify exactly one grant exists
    const status = await getPatronStatus('u1', ctx);
    expect(status.ok).toBe(true);
    if (status.ok) {
        expect(status.data.activeGrants).toHaveLength(1);
    }
  });

  it('SMOKE: revoked grant blocks access even if Payment exists', async () => {
    // 1. Fulfill qualifying payment
    await fulfillPayment({
      paymentId: 'pay_qualifying',
      userId: 'u1',
      amountMinor: 1000,
      currency: 'PLN',
    }, ctx);

    // 2. Revoke patron (admin action)
    const revokeResult = await revokePatron({ userId: 'u1', note: 'Manual revocation' }, { ...ctx, actor: { type: 'admin', userId: 'a1' } });
    expect(revokeResult.ok).toBe(true);

    // 3. Verify access truth is now false
    const status = await getPatronStatus('u1', ctx);
    expect(status.ok).toBe(true);
    if (status.ok) {
        expect(status.data.activeGrants).toHaveLength(0);
        expect(status.data.isPatron).toBe(false);
    }

    // 4. Verify Payment fact remains SUCCEEDED
    const payment = await mockPrisma.payment.findUnique({ where: { id: 'pay_qualifying' } });
    expect(payment.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it('SMOKE: User.isPatron and Clerk metadata are NOT the primary truth (getPatronStatus check)', async () => {
    // 1. Fulfill qualifying
    await fulfillPayment({
      paymentId: 'pay_qualifying',
      userId: 'u1',
      amountMinor: 1000,
      currency: 'PLN',
    }, ctx);

    // 2. Manually set User.isPatron to false (drift)
    await mockPrisma.user.update({ where: { id: 'u1' }, data: { isPatron: false } });

    // 3. getPatronStatus should report activeGrants: length 1
    const status = await getPatronStatus('u1', ctx);
    expect(status.ok).toBe(true);
    if (status.ok) {
        expect(status.data.activeGrants).toHaveLength(1);
    }
  });
});
