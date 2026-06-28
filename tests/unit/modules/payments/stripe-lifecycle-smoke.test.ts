import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentStatus, PatronGrantSource } from '@prisma/client';
import { handleDispute } from '@/lib/modules/payments/application/handle-dispute.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { getPatronStatus, revokePatron } from '@/lib/modules/patron';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/observability', () => ({
  recordMetric: vi.fn(),
  recordAlert: vi.fn(),
}));

vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: { syncClerkAccess: vi.fn() },
}));

type UserRecord = {
  id: string;
  email: string;
  isPatron: boolean;
  patronSince: Date | null;
  patronSource: PatronGrantSource | null;
};

type PaymentRecord = {
  id: string;
  userId: string;
  stripeIntentId: string;
  amountMinor: number;
  refundedAmountMinor: number;
  currency: string;
  status: PaymentStatus;
};

type GrantRecord = {
  id: string;
  userId: string;
  source: PatronGrantSource;
  paymentId: string | null;
  grantedById: string | null;
  reason: string | null;
  createdAt: Date;
  revokedAt: Date | null;
};

function createHarness() {
  const state = {
    users: new Map<string, UserRecord>(),
    payments: new Map<string, PaymentRecord>(),
    totals: new Map<string, { userId: string; currency: string; amountMinor: number }>(),
    grants: [] as GrantRecord[],
    auditLogs: [] as any[],
  };

  const withTotals = (user: UserRecord) => ({
    ...user,
    paymentTotals: Array.from(state.totals.values()).filter((total) => total.userId === user.id),
  });

  const matchesGrantWhere = (grant: GrantRecord, where: any) => {
    if (where.userId !== undefined && grant.userId !== where.userId) return false;
    if (where.paymentId !== undefined && grant.paymentId !== where.paymentId) return false;
    if (where.source !== undefined && grant.source !== where.source) return false;
    if (where.reason !== undefined && grant.reason !== where.reason) return false;
    if (where.revokedAt === null && grant.revokedAt !== null) return false;
    if (where.revokedAt?.not === null && grant.revokedAt === null) return false;
    return true;
  };

  const db: any = {
    payment: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id) return state.payments.get(where.id) ?? null;
        if (where.stripeIntentId) {
          return Array.from(state.payments.values()).find((payment) => payment.stripeIntentId === where.stripeIntentId) ?? null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const payment = state.payments.get(where.id);
        if (!payment) throw new Error(`Payment not found: ${where.id}`);
        Object.assign(payment, data);
        return payment;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const payment of state.payments.values()) {
          if (where.id !== undefined && payment.id !== where.id) continue;
          if (where.status !== undefined && payment.status !== where.status) continue;
          if (where.refundedAmountMinor !== undefined && payment.refundedAmountMinor !== where.refundedAmountMinor) continue;
          Object.assign(payment, data);
          count += 1;
        }
        return { count };
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }) => {
        const user = state.users.get(where.id);
        return user ? withTotals(user) : null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const user = state.users.get(where.id);
        if (!user) throw new Error(`User not found: ${where.id}`);
        Object.assign(user, data);
        return withTotals(user);
      }),
    },
    patronGrant: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.paymentId !== undefined) return state.grants.find((grant) => grant.paymentId === where.paymentId) ?? null;
        return null;
      }),
      findFirst: vi.fn(async ({ where, orderBy }) => {
        const grants = state.grants.filter((grant) => matchesGrantWhere(grant, where));
        if (orderBy?.createdAt === 'asc') grants.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return grants[0] ?? null;
      }),
      findMany: vi.fn(async ({ where, orderBy }) => {
        const grants = state.grants.filter((grant) => matchesGrantWhere(grant, where));
        if (orderBy?.createdAt === 'asc') grants.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return grants;
      }),
      create: vi.fn(async ({ data }) => {
        const grant = {
          ...data,
          id: `grant_${state.grants.length + 1}`,
          grantedById: data.grantedById ?? null,
          reason: data.reason ?? null,
          createdAt: new Date(`2026-06-12T00:00:0${state.grants.length}Z`),
          revokedAt: null,
        } as GrantRecord;
        state.grants.push(grant);
        return grant;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const grant of state.grants) {
          if (!matchesGrantWhere(grant, where)) continue;
          Object.assign(grant, data);
          count += 1;
        }
        return { count };
      }),
    },
    userPaymentTotal: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = `${where.userId_currency.userId}:${where.userId_currency.currency}`;
        const existing = state.totals.get(key);
        if (existing) {
          existing.amountMinor += update.amountMinor.increment;
          return existing;
        }
        state.totals.set(key, { ...create });
        return state.totals.get(key);
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }) => {
        state.auditLogs.push(data);
        return data;
      }),
    },
    $executeRaw: vi.fn(async (_strings, amountMinor: number, userId: string, currency: string) => {
      const key = `${userId}:${currency}`;
      const total = state.totals.get(key);
      if (total) total.amountMinor = Math.max(0, total.amountMinor - amountMinor);
      return 1;
    }),
    $transaction: vi.fn(async (callback) => callback(db)),
  };

  const ctx: any = {
    actor: { type: 'system', reason: 'stripe lifecycle smoke test' },
    db: {
      read: db,
      writeTransaction: async (callback: any) => db.$transaction(callback),
    },
    prisma: db,
    requestId: 'stripe-lifecycle-smoke-test',
    now: () => new Date('2026-06-12T12:00:00Z'),
  };

  const seedUser = (id: string, isPatron = false) => {
    state.users.set(id, {
      id,
      email: `${id}@example.com`,
      isPatron,
      patronSince: isPatron ? new Date('2026-06-01T00:00:00Z') : null,
      patronSource: isPatron ? PatronGrantSource.STRIPE_TIP : null,
    });
  };

  const seedPayment = (id: string, userId: string, status: PaymentStatus = PaymentStatus.SUCCEEDED) => {
    const payment = {
      id,
      userId,
      stripeIntentId: `pi_${id}`,
      amountMinor: 1000,
      refundedAmountMinor: 0,
      currency: 'PLN',
      status,
    };
    state.payments.set(id, payment);
    state.totals.set(`${userId}:PLN`, { userId, currency: 'PLN', amountMinor: 1000 });
    return payment;
  };

  const seedGrant = (id: string, userId: string, paymentId: string, reason = 'Granted after successful one-time Stripe tip') => {
    const grant = {
      id,
      userId,
      source: PatronGrantSource.STRIPE_TIP,
      paymentId,
      grantedById: null,
      reason,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      revokedAt: null,
    };
    state.grants.push(grant);
    return grant;
  };

  const activeGrants = (userId: string) => state.grants.filter((grant) => grant.userId === userId && grant.revokedAt === null);

  return { ctx, db, state, seedUser, seedPayment, seedGrant, activeGrants };
}

describe('Stripe refund/dispute to PatronGrant lifecycle smoke test', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    vi.clearAllMocks();
    harness = createHarness();
  });

  it('dispute opened denies access by temporarily revoking the payment grant', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1');
    harness.seedGrant('grant_1', 'user_1', 'pay_1');

    const result = await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'needs_response', isLost: false, isWon: false }, harness.ctx);

    expect(result.ok).toBe(true);
    expect(harness.state.payments.get('pay_1')?.status).toBe(PaymentStatus.DISPUTED);
    expect(harness.activeGrants('user_1')).toHaveLength(0);
    const status = await getPatronStatus('user_1', harness.ctx);
    expect(status.ok && status.data.isPatron).toBe(false);
  });

  it('duplicate dispute opened is idempotent', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1');
    const grant = harness.seedGrant('grant_1', 'user_1', 'pay_1');

    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'needs_response', isLost: false, isWon: false }, harness.ctx);
    const firstRevokedAt = grant.revokedAt;
    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'needs_response', isLost: false, isWon: false }, harness.ctx);

    expect(harness.state.grants).toHaveLength(1);
    expect(grant.revokedAt).toBe(firstRevokedAt);
    expect(harness.activeGrants('user_1')).toHaveLength(0);
  });

  it('dispute won reactivates only the grant suspended by the same dispute lifecycle', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1');
    const grant = harness.seedGrant('grant_1', 'user_1', 'pay_1');

    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'needs_response', isLost: false, isWon: false }, harness.ctx);
    expect(grant.revokedAt).toBeInstanceOf(Date);

    const result = await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'won', isLost: false, isWon: true }, harness.ctx);

    expect(result.ok).toBe(true);
    expect(grant.revokedAt).toBeNull();
    expect(harness.activeGrants('user_1')).toEqual([grant]);
  });

  it('dispute won after full refund does not reactivate the grant', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1');
    const grant = harness.seedGrant('grant_1', 'user_1', 'pay_1');

    await handleRefund({ paymentId: 'pay_1', reportedRefundedMinor: 1000 }, harness.ctx);
    expect(grant.revokedAt).toBeInstanceOf(Date);

    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'won', isLost: false, isWon: true }, harness.ctx);

    expect(harness.state.payments.get('pay_1')?.status).toBe(PaymentStatus.REFUNDED);
    expect(grant.revokedAt).toBeInstanceOf(Date);
    expect(harness.activeGrants('user_1')).toHaveLength(0);
  });

  it('dispute won after manual revoke does not reactivate the grant', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1', PaymentStatus.DISPUTED);
    const grant = harness.seedGrant('grant_1', 'user_1', 'pay_1');

    const revokeResult = await revokePatron({ userId: 'user_1', paymentId: 'pay_1', note: 'Manual policy revoke' }, { ...harness.ctx, actor: { type: 'admin', userId: 'admin_1' } });
    expect(revokeResult.ok).toBe(true);

    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'won', isLost: false, isWon: true }, harness.ctx);

    expect(grant.reason).toBe('Manual policy revoke');
    expect(grant.revokedAt).toBeInstanceOf(Date);
    expect(harness.activeGrants('user_1')).toHaveLength(0);
  });

  it('dispute lost permanently revokes access', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1');
    const grant = harness.seedGrant('grant_1', 'user_1', 'pay_1');

    const result = await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'lost', isLost: true, isWon: false }, harness.ctx);

    expect(result.ok).toBe(true);
    expect(harness.state.payments.get('pay_1')?.status).toBe(PaymentStatus.CHARGEBACK_LOST);
    expect(grant.reason).toContain('lost');
    expect(harness.activeGrants('user_1')).toHaveLength(0);
  });

  it('duplicate lost and duplicate full refund are idempotent', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1');
    const grant = harness.seedGrant('grant_1', 'user_1', 'pay_1');

    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'lost', isLost: true, isWon: false }, harness.ctx);
    const totalAfterLost = harness.state.totals.get('user_1:PLN')?.amountMinor;
    const lostRevokedAt = grant.revokedAt;
    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'lost', isLost: true, isWon: false }, harness.ctx);

    expect(harness.state.totals.get('user_1:PLN')?.amountMinor).toBe(totalAfterLost);
    expect(grant.revokedAt).toBe(lostRevokedAt);

    harness.seedUser('user_2', true);
    harness.seedPayment('pay_2', 'user_2');
    const refundGrant = harness.seedGrant('grant_2', 'user_2', 'pay_2');
    await handleRefund({ paymentId: 'pay_2', reportedRefundedMinor: 1000 }, harness.ctx);
    const totalAfterRefund = harness.state.totals.get('user_2:PLN')?.amountMinor;
    const refundRevokedAt = refundGrant.revokedAt;
    await handleRefund({ paymentId: 'pay_2', reportedRefundedMinor: 1000 }, harness.ctx);

    expect(harness.state.totals.get('user_2:PLN')?.amountMinor).toBe(totalAfterRefund);
    expect(refundGrant.revokedAt).toBe(refundRevokedAt);
  });

  it('unrelated grants remain unchanged during dispute transitions', async () => {
    harness.seedUser('user_1', true);
    harness.seedPayment('pay_1', 'user_1');
    harness.seedPayment('pay_2', 'user_1');
    const disputedGrant = harness.seedGrant('grant_1', 'user_1', 'pay_1');
    const unrelatedGrant = harness.seedGrant('grant_2', 'user_1', 'pay_2');

    await handleDispute({ stripeIntentId: 'pi_pay_1', disputeId: 'dp_1', status: 'needs_response', isLost: false, isWon: false }, harness.ctx);

    expect(disputedGrant.revokedAt).toBeInstanceOf(Date);
    expect(unrelatedGrant.revokedAt).toBeNull();
    expect(harness.activeGrants('user_1')).toEqual([unrelatedGrant]);
  });

  it('User.isPatron is not access truth', async () => {
    harness.seedUser('user_1', true);
    const statusWithoutGrant = await getPatronStatus('user_1', harness.ctx);

    expect(statusWithoutGrant.ok && statusWithoutGrant.data.isPatron).toBe(false);
    expect(harness.state.users.get('user_1')?.isPatron).toBe(true);

    harness.seedPayment('pay_1', 'user_1');
    harness.seedGrant('grant_1', 'user_1', 'pay_1');
    harness.state.users.get('user_1')!.isPatron = false;

    const statusWithGrant = await getPatronStatus('user_1', harness.ctx);

    expect(statusWithGrant.ok && statusWithGrant.data.isPatron).toBe(true);
    expect(statusWithGrant.ok && statusWithGrant.data.activeGrants).toHaveLength(1);
  });
});
