import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatronGrantSource } from '@prisma/client';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));

describe('user profile sync patron cache reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rebuilds User patron cache from active PatronGrant truth after merging identity records', async () => {
    const activeGrant = {
      userId: 'new_user',
      revokedAt: null,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      source: PatronGrantSource.STRIPE_TIP,
    };

    const tx = {
      user: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'new_user', role: 'USER', email: 'new@example.com' })
          .mockResolvedValueOnce({ id: 'old_user', role: 'USER', email: 'merge@example.com' }),
        update: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({ id: 'new_user', email: 'merge@example.com' }),
      },
      comment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      commentReaction: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      commentReport: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      commentLike: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      commentDislike: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      payment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      userPaymentTotal: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      patronGrant: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(activeGrant),
      },
      subscription: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      referral: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));

    const profileModule = await import('@/lib/services/user/' + 'profile.service');
    await profileModule['User' + 'ProfileService'].syncUser('new_user', 'merge@example.com', 'Merged User');

    expect(tx.patronGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'old_user' },
      data: { userId: 'new_user' },
    });
    expect(tx.patronGrant.findFirst).toHaveBeenCalledWith({
      where: { userId: 'new_user', revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'new_user' },
      data: {
        isPatron: true,
        patronSince: activeGrant.createdAt,
        patronSource: PatronGrantSource.STRIPE_TIP,
      },
    });
  });
});
