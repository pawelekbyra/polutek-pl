import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { PaymentStatus, PatronGrantSource } from '@prisma/client';
import { grantPatron } from '@/lib/modules/patron';

const { mockSyncClerkAccess } = vi.hoisted(() => ({
  mockSyncClerkAccess: vi.fn().mockResolvedValue(undefined),
}));

// Mocking dependencies
vi.mock('@/lib/logger');
vi.mock('@/lib/observability');
vi.mock('@/lib/modules/email/application/send-transactional-email.use-case');
vi.mock('@/lib/modules/users/application/sync-clerk-access', () => ({
  syncClerkAccess: mockSyncClerkAccess,
}));
vi.mock('@/lib/modules/audit');

// Mock getPaymentCurrencyLimits
vi.mock('@/lib/payments/currency-settings', () => ({
  getPaymentCurrencyLimits: vi.fn().mockResolvedValue({
    PLN: { minAmountMinor: 1000 },
    EUR: { minAmountMinor: 1000 },
  }),
  resolvePatronThresholdMinor: (_currency: string, fallbackMinor: number) => fallbackMinor,
}));

vi.mock('@/lib/modules/patron', () => ({
  grantPatron: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      isPatron: true,
      normalizedTotal: 25,
    }
  }),
}));

vi.mock('@/lib/modules/users', () => ({
  normalizePaymentTotals: vi.fn().mockReturnValue(25),
  syncClerkAccess: mockSyncClerkAccess,
}));

describe('fulfillPayment use case', () => {
  let mockPrisma: any;
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      payment: {
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      userPaymentTotal: {
        upsert: vi.fn(),
      },
      patronGrant: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
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
    };
  });

  it('grants patron status when payment is above threshold', async () => {
    const input = {
      paymentId: 'pay_123',
      userId: 'user_123',
      amountMinor: 1000,
      currency: 'PLN',
    };

    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_123',
      userId: 'user_123',
      amountMinor: 1000,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_123',
      email: 'test@example.com',
      isPatron: false,
      paymentTotals: [],
      patronGrants: [],
    });
    mockPrisma.user.update.mockResolvedValue({
      id: 'user_123',
      isPatron: true,
      paymentTotals: [{ currency: 'PLN', amountMinor: 1000 }],
    });

    const result = await fulfillPayment(input, ctx);

    expect(result.ok).toBe(true);
    expect(grantPatron).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_123',
        source: 'stripe_tip',
        paymentId: 'pay_123',
      }),
      expect.objectContaining({
        actor: { type: 'system' }
      }),
      expect.anything()
    );
  });

  it('does NOT grant patron status when payment is below threshold', async () => {
    const input = {
      paymentId: 'pay_123',
      userId: 'user_123',
      amountMinor: 999, // 9.99 PLN < 10 PLN threshold
      currency: 'PLN',
    };

    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_123',
      userId: 'user_123',
      amountMinor: 999,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_123',
      email: 'test@example.com',
      isPatron: false,
      paymentTotals: [],
      patronGrants: [],
    });

    const result = await fulfillPayment(input, ctx);

    expect(result.ok).toBe(true);
    expect(grantPatron).not.toHaveBeenCalled();
  });

  it('does NOT grant patron status when currency is not supported by limits', async () => {
    const input = {
      paymentId: 'pay_123',
      userId: 'user_123',
      amountMinor: 1000,
      currency: 'JPY',
    };

    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_123',
      userId: 'user_123',
      amountMinor: 1000,
      currency: 'JPY',
      status: PaymentStatus.SUCCEEDED,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_123',
      email: 'test@example.com',
      isPatron: false,
      paymentTotals: [],
      patronGrants: [],
    });

    const result = await fulfillPayment(input, ctx);

    if (!result.ok) {
        console.error('Replay failed:', result.error);
    }
    expect(result.ok).toBe(true);
    expect(grantPatron).not.toHaveBeenCalled();
  });

  it('handles replay correctly (already SUCCEEDED)', async () => {
    const input = {
      paymentId: 'pay_123',
      userId: 'user_123',
      amountMinor: 2500,
      currency: 'PLN',
    };

    // CAS returns 0 because status is already SUCCEEDED
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_123',
      userId: 'user_123',
      amountMinor: 2500,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_123',
      email: 'test@example.com',
      isPatron: true,
      paymentTotals: [{ currency: 'PLN', amountMinor: 2500 }],
      patronGrants: [{ id: 'grant_1' }],
    });

    const result = await fulfillPayment(input, ctx);

    if (!result.ok) {
        console.error('Replay failed:', result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.isFirstFulfillment).toBe(false);
    }
    expect(grantPatron).not.toHaveBeenCalled(); // No new grant on replay
  });

  it('syncs Clerk with truth even on replay if legacy isPatron is false but active grant exists', async () => {
    const { syncClerkAccess } = await import('@/lib/modules/users/application/sync-clerk-access');
    const input = {
      paymentId: 'pay_replay',
      userId: 'user_mismatch',
      amountMinor: 2500,
      currency: 'PLN',
    };

    // CAS returns 0 because status is already SUCCEEDED
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_replay',
      userId: 'user_mismatch',
      amountMinor: 2500,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
    });
    // Legacy cache says NOT patron
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_mismatch',
      email: 'test@example.com',
      isPatron: false,
      paymentTotals: [{ currency: 'PLN', amountMinor: 2500 }],
      patronGrants: [{ id: 'grant_existing' }], // Source of truth says IS patron
    });

    const result = await fulfillPayment(input, ctx);

    expect(result.ok).toBe(true);
    // Should sync Clerk with isPatron: true based on patronGrants.length > 0
    expect(syncClerkAccess).toHaveBeenCalledWith('user_mismatch', true, 25);
  });
});
