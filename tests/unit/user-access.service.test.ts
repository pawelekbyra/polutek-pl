import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatronGrantSource } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { UserAccessService } from '@/lib/services/user-access.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patronGrant: {
      findFirst: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/clerk', () => ({ getClerkClient: vi.fn() }));
vi.mock('@/lib/services/audit.service', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

describe('UserAccessService.recalculateUserPatronStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the user as Patron when another active grant remains after a payment grant is revoked', async () => {
    const activeReferralGrant = {
      id: 'grant_referral_1',
      userId: 'user_1',
      source: PatronGrantSource.REFERRAL,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      revokedAt: null,
    };

    vi.mocked(prisma.patronGrant.findFirst).mockResolvedValue(activeReferralGrant as any);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user_1',
      isPatron: true,
      patronSince: activeReferralGrant.createdAt,
      patronSource: PatronGrantSource.REFERRAL,
      paymentTotals: [],
    } as any);

    const result = await UserAccessService.recalculateUserPatronStatus('user_1');

    expect(result.isPatron).toBe(true);
    expect(prisma.patronGrant.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user_1' },
      data: expect.objectContaining({
        isPatron: true,
        patronSince: activeReferralGrant.createdAt,
        patronSource: PatronGrantSource.REFERRAL,
      }),
    }));
  });
});
