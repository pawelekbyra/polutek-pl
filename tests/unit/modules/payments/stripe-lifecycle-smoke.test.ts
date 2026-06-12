import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { handleDispute } from '@/lib/modules/payments/application/handle-dispute.use-case';
import { getPatronStatus } from '@/lib/modules/patron';
import { PaymentStatus } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/logger');
vi.mock('@/lib/observability');
vi.mock('@/lib/services/email.service');
vi.mock('@/lib/services/user-access.service');
vi.mock('@/lib/services/audit.service');
vi.mock('@/lib/modules/audit');

// Mock getPaymentCurrencyLimits
vi.mock('@/lib/payments/currency-settings', () => ({
  getPaymentCurrencyLimits: vi.fn().mockResolvedValue({
    PLN: { minAmountMinor: 1000 },
  }),
}));

describe('Stripe Refund and Dispute PatronGrant Lifecycle Smoke Test', () => {
  let mockPrisma: any;
  let ctx: any;
  let dbState: {
    users: Map<string, any>;
    payments: Map<string, any>;
    grants: any[];
    totals: Map<string, any>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    dbState = {
      users: new Map<string, any>(),
      payments: new Map<string, any>(),
      grants: [] as any[],
      totals: new Map<string, any>(),
    };

    mockPrisma = {
      payment: {
        updateMany: vi.fn(async ({ where, data }) => {
            const p = dbState.payments.get(where.id);
            if (p && (where.status === undefined || p.status === where.status)) {
                Object.assign(p as any, data);
                return { count: 1 };
            }
            return { count: 0 };
        }),
        update: vi.fn(async ({ where, data }) => {
            const p = dbState.payments.get(where.id);
            if (p) {
                Object.assign(p as any, data);
                return p;
            }
        }),
        findUnique: vi.fn(async ({ where }) => {
            if (where.stripeIntentId) {
                return Array.from(dbState.payments.values()).find(p => p.stripeIntentId === where.stripeIntentId);
            }
            return dbState.payments.get(where.id);
        }),
        findFirst: vi.fn(async ({ where }) => {
             if (where.stripeIntentId) {
                return Array.from(dbState.payments.values()).find(p => p.stripeIntentId === where.stripeIntentId);
            }
            return null;
        }),
      },
      user: {
        findUnique: vi.fn(async ({ where }) => {
            const u = dbState.users.get(where.id);
            if (!u) return null;
            return {
                ...u,
                paymentTotals: Array.from(dbState.totals.values()).filter(t => t.userId === u.id)
            };
        }),
        update: vi.fn(async ({ where, data }) => {
            const u = dbState.users.get(where.id);
            if (u) {
                Object.assign(u, data);
                return {
                    ...u,
                    paymentTotals: Array.from(dbState.totals.values()).filter(t => t.userId === u.id)
                };
            }
        }),
      },
      userPaymentTotal: {
        upsert: vi.fn(async ({ where, update, create }) => {
            const key = `${where.userId_currency.userId}_${where.userId_currency.currency}`;
            let t = dbState.totals.get(key);
            if (t) {
                const total = t as any;
                if (update.amountMinor.increment !== undefined) total.amountMinor += update.amountMinor.increment;
                if (update.amountMinor.decrement !== undefined) total.amountMinor -= update.amountMinor.decrement;
            } else {
                t = { ...create };
                dbState.totals.set(key, t);
            }
            return t;
        }),
        findUnique: vi.fn(async ({ where }) => {
             const key = `${where.userId_currency.userId}_${where.userId_currency.currency}`;
             return dbState.totals.get(key);
        }),
        update: vi.fn(async ({ where, data }) => {
             const key = `${where.userId_currency.userId}_${where.userId_currency.currency}`;
             const t = dbState.totals.get(key);
             if (t) {
                 const total = t as any;
                 if (data.amountMinor.increment !== undefined) total.amountMinor += data.amountMinor.increment;
                 if (data.amountMinor.decrement !== undefined) total.amountMinor -= data.amountMinor.decrement;
                 return total;
             }
        })
      },
      patronGrant: {
        create: vi.fn(async ({ data }) => {
            const g = { ...data, id: `g_${dbState.grants.length + 1}`, createdAt: new Date(), revokedAt: null };
            dbState.grants.push(g);
            return g;
        }),
        findUnique: vi.fn(async ({ where }) => dbState.grants.find(g => g.paymentId === where.paymentId)),
        findFirst: vi.fn(async ({ where }) => {
            if (where.revokedAt === null) {
                return dbState.grants.find((g: any) => g.userId === where.userId && g.revokedAt === null);
            }
            return dbState.grants.find((g: any) => g.userId === where.userId);
        }),
        findMany: vi.fn(async ({ where }) => {
            return dbState.grants.filter((g: any) => {
                const userIdMatch = g.userId === where.userId;
                const revokedMatch = where.revokedAt === undefined || (where.revokedAt === null ? g.revokedAt === null : g.revokedAt !== null);
                return userIdMatch && revokedMatch;
            });
        }),
        updateMany: vi.fn(async ({ where, data }) => {
            let count = 0;
            dbState.grants.forEach((g: any) => {
                const paymentMatch = where.paymentId ? g.paymentId === where.paymentId : true;
                const userIdMatch = where.userId ? g.userId === where.userId : true;

                let revokedMatch = true;
                if (where.revokedAt === null) {
                    revokedMatch = g.revokedAt === null;
                } else if (where.revokedAt !== undefined && where.revokedAt !== null) {
                    if (where.revokedAt.not === null) {
                        revokedMatch = g.revokedAt !== null;
                    } else {
                        revokedMatch = g.revokedAt !== null;
                    }
                }

                if (paymentMatch && userIdMatch && revokedMatch) {
                    if (data.revokedAt === null) {
                        g.revokedAt = null;
                    } else if (data.revokedAt instanceof Date) {
                        g.revokedAt = data.revokedAt;
                    }
                    if (data.reason !== undefined) {
                        g.reason = data.reason;
                    }
                    count++;
                }
            });
            return { count };
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

    // Setup initial users
    dbState.users.set('u1', { id: 'u1', email: 'u1@example.com', isPatron: false, language: 'pl' });
    dbState.users.set('u2', { id: 'u2', email: 'u2@example.com', isPatron: false, language: 'pl' });
  });

  async function fulfill(userId: string, paymentId: string, amountMinor: number, stripeIntentId: string) {
    dbState.payments.set(paymentId, { id: paymentId, userId, amountMinor, currency: 'PLN', status: PaymentStatus.PENDING, stripeIntentId, refundedAmountMinor: 0 });
    return await fulfillPayment({ paymentId, userId, amountMinor, currency: 'PLN' }, ctx);
  }

  it('LIFECYCLE: qualifying payment -> active grant -> full refund -> revoked', async () => {
    // 1. Success
    await fulfill('u1', 'pay_1', 1000, 'pi_1');
    let status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(true);

    // 2. Full Refund
    const refundResult = await handleRefund({ paymentId: 'pay_1', reportedRefundedMinor: 1000 }, ctx);
    expect(refundResult.ok).toBe(true);

    // 3. Verify Revoked
    status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(false);
    expect(dbState.grants[0].revokedAt).not.toBeNull();
    expect(dbState.payments.get('pay_1').status).toBe(PaymentStatus.REFUNDED);

    // 4. Idempotency
    const replayRefund = await handleRefund({ paymentId: 'pay_1', reportedRefundedMinor: 1000 }, ctx);
    expect(replayRefund.ok).toBe(true);
    // Should still be revoked, no extra side effects (mock doesn't track extra side effects well but we check final state)
    status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(false);
  });

  it('LIFECYCLE: dispute opened (suspended) -> dispute won (reactivated)', async () => {
    // 1. Success
    await fulfill('u1', 'pay_2', 1000, 'pi_2');
    let status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(true);

    // 2. Dispute Opened
    const disputeOpened = await handleDispute({ stripeIntentId: 'pi_2', status: 'needs_response', isLost: false, isWon: false }, ctx);
    expect(disputeOpened.ok).toBe(true);

    // 3. Verify Suspended (Revoked with reason)
    status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(false);
    expect(dbState.grants[0].revokedAt).not.toBeNull();
    expect(dbState.grants[0].reason).toBe('DISPUTE_OPENED');
    expect(dbState.payments.get('pay_2').status).toBe(PaymentStatus.DISPUTED);

    // 4. Dispute Won
    const disputeWon = await handleDispute({ stripeIntentId: 'pi_2', status: 'won', isLost: false, isWon: true }, ctx);
    expect(disputeWon.ok).toBe(true);

    // 5. Verify Reactivated
    status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(true);
    expect(dbState.grants[0].revokedAt).toBeNull();
    expect(dbState.payments.get('pay_2').status).toBe(PaymentStatus.SUCCEEDED);
  });

  it('LIFECYCLE: dispute opened (suspended) -> dispute lost (revoked)', async () => {
    // 1. Success
    await fulfill('u1', 'pay_3', 1000, 'pi_3');

    // 2. Dispute Opened
    await handleDispute({ stripeIntentId: 'pi_3', status: 'needs_response', isLost: false, isWon: false }, ctx);

    // 3. Dispute Lost
    const disputeLost = await handleDispute({ stripeIntentId: 'pi_3', status: 'lost', isLost: true, isWon: false }, ctx);
    expect(disputeLost.ok).toBe(true);

    // 4. Verify Revoked
    const status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(false);
    expect(dbState.grants[0].revokedAt).not.toBeNull();
    expect(dbState.grants[0].reason).toBe('Payment disputed: lost');
    expect(dbState.payments.get('pay_3').status).toBe(PaymentStatus.CHARGEBACK_LOST);
  });

  it('ISOLATION: events affect only linked grant', async () => {
    // User 1 has two grants
    await fulfill('u1', 'pay_4a', 1000, 'pi_4a');
    await fulfill('u1', 'pay_4b', 1000, 'pi_4b');
    // User 2 has one grant
    await fulfill('u2', 'pay_5', 1000, 'pi_5');

    expect(dbState.grants).toHaveLength(3);

    // Refund User 1's first payment
    await handleRefund({ paymentId: 'pay_4a', reportedRefundedMinor: 1000 }, ctx);

    // User 1 should still be patron (due to pay_4b)
    let status1 = await getPatronStatus('u1', ctx);
    expect(status1.ok && status1.data.isPatron).toBe(true);
    expect(status1.ok && status1.data.activeGrants).toHaveLength(1);
    expect(status1.ok && status1.data.activeGrants[0].paymentId).toBe('pay_4b');

    // User 2 should be unaffected
    let status2 = await getPatronStatus('u2', ctx);
    expect(status2.ok && status2.data.isPatron).toBe(true);
    expect(status2.ok && status2.data.activeGrants).toHaveLength(1);
    expect(status2.ok && status2.data.activeGrants[0].paymentId).toBe('pay_5');
  });

  it('ACCESS TRUTH: stale User.isPatron cache does not grant access', async () => {
    // 1. Success
    await fulfill('u1', 'pay_6', 1000, 'pi_6');

    // 2. Full Refund (Revokes access)
    await handleRefund({ paymentId: 'pay_6', reportedRefundedMinor: 1000 }, ctx);

    // 3. Manually Drift the cache (User.isPatron = true)
    dbState.users.get('u1').isPatron = true;

    // 4. getPatronStatus (Backend Truth) should still be false
    const status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(false);
  });

  it('PARTIAL REFUND: current behavior check (no revocation)', async () => {
    // 1. Success
    await fulfill('u1', 'pay_7', 2000, 'pi_7'); // 20 PLN

    // 2. Partial Refund (10 PLN)
    const partialRefund = await handleRefund({ paymentId: 'pay_7', reportedRefundedMinor: 1000 }, ctx);
    expect(partialRefund.ok).toBe(true);

    // 3. Verify NOT Revoked (Policy: partial refund doesn't revoke unless it falls below threshold)
    // Actually, current handleRefund only revokes if cappedRefunded >= payment.amountMinor.
    // If it falls below threshold, it recalculates. But recalculate only checks activeGrants.
    // And handleRefund doesn't revoke activeGrants on partial refund.
    // So the grant remains ACTIVE even if total paid falls below threshold?
    // Wait, let's re-read handleRefund and recalculate.
    // handleRefund calls recalculatePatronStatus for partial refund.
    // recalculatePatronStatus looks at activeGrant = repo.findFirstActiveGrant(userId, db).
    // It doesn't check if the grants are still "valid" according to current totals.
    // This is correct according to "Patronage is a reward for a qualifying donation... permanent/lifetime by default".

    const status = await getPatronStatus('u1', ctx);
    expect(status.ok && status.data.isPatron).toBe(true);
    expect(dbState.grants[dbState.grants.length - 1].revokedAt).toBeNull();
  });
});
