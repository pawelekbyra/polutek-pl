import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
import { MainChannelService } from '@/lib/modules/channel';
import { PaymentStatus, AccessTier, VideoStatus, PatronGrantSource } from '@prisma/client';

// Mocking external services
vi.mock('@/lib/logger');
vi.mock('@/lib/observability');
vi.mock('@/lib/services/email.service');
vi.mock('@/lib/services/user-access.service');
vi.mock('@/lib/services/audit.service');

// Mock getPaymentCurrencyLimits to use launch defaults
vi.mock('@/lib/payments/currency-settings', () => ({
  getPaymentCurrencyLimits: vi.fn().mockResolvedValue({
    PLN: { minAmountMinor: 1000, minAmount: 10 },
    EUR: { minAmountMinor: 1000, minAmount: 10 },
    USD: { minAmountMinor: 1000, minAmount: 10 },
    CHF: { minAmountMinor: 1000, minAmount: 10 },
  }),
}));

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({
        id: 'main-channel-id',
        slug: 'polutek',
        isApproved: true,
        isPrimary: true
    }),
  },
}));

vi.mock('@/lib/modules/patron', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    grantPatron: vi.fn().mockImplementation(async (input: any) => {
        return {
            ok: true,
            data: {
                userId: input.userId,
                isPatron: true,
                normalizedTotal: 10
            }
        }
    }),
    revokePatron: vi.fn().mockResolvedValue({
        ok: true,
        data: { userId: 'user_123', isPatron: false, normalizedTotal: 0 }
    }),
    getPatronStatus: vi.fn().mockImplementation(async (userId: string, ctx: any) => {
        const activeGrants = await ctx.db.read.patronGrant.findMany({ where: { userId, revokedAt: null } });
        return {
            ok: true,
            data: {
                userId,
                isPatron: activeGrants.length > 0,
                activeGrants
            }
        };
    })
  };
});

describe('LAUNCH-FIX-003: Payment to PatronGrant Smoke Test', () => {
  let mockPrisma: any;
  let ctx: any;
  const now = new Date('2026-01-01T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      payment: {
        updateMany: vi.fn().mockImplementation(async (args: any) => {
           if (args.where.status === PaymentStatus.PENDING && args.data.status === PaymentStatus.SUCCEEDED) {
               return { count: 1 };
           }
           if (args.where.refundedAmountMinor !== undefined) {
               return { count: 1 };
           }
           return { count: 0 };
        }),
        findUnique: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      userPaymentTotal: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      patronGrant: {
        create: vi.fn().mockResolvedValue({ id: 'g1' }),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      video: {
        findFirst: vi.fn(),
      },
      emailTemplate: {
        findUnique: vi.fn().mockResolvedValue({ id: 't1' }),
      },
      $transaction: vi.fn(async (fn: any) => await fn(mockPrisma)),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    ctx = {
      db: {
        writeTransaction: async (fn: any) => await mockPrisma.$transaction(fn),
        read: mockPrisma,
      },
      prisma: mockPrisma,
      actor: { type: 'admin', userId: 'admin_1' },
      now: () => now,
    };
  });

  const patronVideo = {
    id: 'v1',
    creatorId: 'main-channel-id',
    status: VideoStatus.PUBLISHED,
    tier: AccessTier.PATRON,
    publishedAt: new Date(now.getTime() - 1000),
    creator: { id: 'main-channel-id', isApproved: true, isPrimary: true }
  };

  it('Evidence 1: Qualifying payment (>= 10 PLN) creates active PatronGrant and enables access', async () => {
    const userId = 'user_123';
    const paymentId = 'pay_qualifying';

    mockPrisma.payment.findUnique.mockResolvedValue({
      id: paymentId, userId, amountMinor: 1000, currency: 'PLN', status: PaymentStatus.SUCCEEDED
    });
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
        if (args.where && args.where.id === userId) return { id: userId, email: 'test@polutek.pl', isPatron: false, isDeleted: false, paymentTotals: [] };
        return null;
    });

    const fulfillResult = await fulfillPayment({ paymentId, userId, amountMinor: 1000, currency: 'PLN' }, ctx);
    expect(fulfillResult.ok).toBe(true);

    const { grantPatron } = await import('@/lib/modules/patron');
    expect(grantPatron).toHaveBeenCalled();

    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    mockPrisma.patronGrant.findMany.mockResolvedValue([{ id: 'grant_1', revokedAt: null }]);

    const accessResult = await checkVideoAccess({ videoIdOrSlug: 'v1' }, { ...ctx, actor: { type: 'user', userId } });
    expect(accessResult.ok).toBe(true);
    if (accessResult.ok) {
        expect(accessResult.data.hasAccess).toBe(true);
    }
  });

  it('Evidence 2: Non-qualifying payment (< 10 PLN) does not create PatronGrant and access remains denied', async () => {
    const userId = 'user_123';
    const paymentId = 'pay_low';

    mockPrisma.payment.findUnique.mockResolvedValue({
      id: paymentId, userId, amountMinor: 500, currency: 'PLN', status: PaymentStatus.SUCCEEDED
    });
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
        if (args.where && args.where.id === userId) return { id: userId, isPatron: false, isDeleted: false, paymentTotals: [] };
        return null;
    });

    const fulfillResult = await fulfillPayment({ paymentId, userId, amountMinor: 500, currency: 'PLN' }, ctx);
    expect(fulfillResult.ok).toBe(true);

    const { grantPatron } = await import('@/lib/modules/patron');
    expect(grantPatron).not.toHaveBeenCalled();

    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    mockPrisma.patronGrant.findMany.mockResolvedValue([]);

    const accessResult = await checkVideoAccess({ videoIdOrSlug: 'v1' }, { ...ctx, actor: { type: 'user', userId } });
    expect(accessResult.ok).toBe(true);
    if (accessResult.ok) {
        expect(accessResult.data.hasAccess).toBe(false);
        expect(accessResult.data.reason).toBe('PATRON_REQUIRED');
    }
  });

  it('Evidence 3: Duplicate payment event is idempotent and does not create duplicate grants', async () => {
    const userId = 'user_123';
    const paymentId = 'pay_qualifying';

    // Simulate CAS failure
    mockPrisma.payment.updateMany.mockImplementation(async () => ({ count: 0 }));

    mockPrisma.payment.findUnique.mockResolvedValue({
      id: paymentId, userId, amountMinor: 1000, currency: 'PLN', status: PaymentStatus.SUCCEEDED
    });
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
        if (args.where && args.where.id === userId) return { id: userId, email: 'test@polutek.pl', isPatron: true, isDeleted: false, paymentTotals: [{ currency: 'PLN', amountMinor: 1000 }] };
        return null;
    });

    const fulfillResult = await fulfillPayment({ paymentId, userId, amountMinor: 1000, currency: 'PLN' }, ctx);
    expect(fulfillResult.ok).toBe(true);

    const { grantPatron } = await import('@/lib/modules/patron');
    expect(grantPatron).not.toHaveBeenCalled();
  });

  it('Evidence 4: Full refund revokes the linked PatronGrant and access is subsequently denied', async () => {
    const userId = 'user_123';
    const paymentId = 'pay_qualifying';

    mockPrisma.payment.findUnique.mockImplementation(async (args: any) => {
       if (args.where.id === paymentId) return { id: paymentId, userId, amountMinor: 1000, currency: 'PLN', status: PaymentStatus.SUCCEEDED, refundedAmountMinor: 0 };
       return null;
    });
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
        if (args.where && args.where.id === userId) return { id: userId, isPatron: true, isDeleted: false, paymentTotals: [] };
        return null;
    });
    mockPrisma.userPaymentTotal.findUnique.mockResolvedValue({ amountMinor: 1000 });

    const refundResult = await handleRefund({ paymentId, reportedRefundedMinor: 1000 }, ctx);
    expect(refundResult.ok).toBe(true);

    const { revokePatron } = await import('@/lib/modules/patron');
    expect(revokePatron).toHaveBeenCalled();

    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    mockPrisma.patronGrant.findMany.mockResolvedValue([]);

    const accessResult = await checkVideoAccess({ videoIdOrSlug: 'v1' }, { ...ctx, actor: { type: 'user', userId } });
    expect(accessResult.ok).toBe(true);
    if (accessResult.ok) {
        expect(accessResult.data.hasAccess).toBe(false);
        expect(accessResult.data.reason).toBe('PATRON_REQUIRED');
    }
  });

  it('Evidence 5: User.isPatron true alone does not grant access if no active PatronGrant exists', async () => {
    const userId = 'user_123';

    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
        if (args.where && args.where.id === userId) return { id: userId, isPatron: true, isDeleted: false, paymentTotals: [] };
        return null;
    });
    mockPrisma.patronGrant.findMany.mockResolvedValue([]);

    const accessResult = await checkVideoAccess({ videoIdOrSlug: 'v1' }, { ...ctx, actor: { type: 'user', userId } });
    expect(accessResult.ok).toBe(true);
    if (accessResult.ok) {
        expect(accessResult.data.hasAccess).toBe(false);
        expect(accessResult.data.reason).toBe('PATRON_REQUIRED');
    }
  });
});
