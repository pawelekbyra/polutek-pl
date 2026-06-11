import { describe, it, expect, vi } from 'vitest';
import { getAdminUsersStats } from '@/lib/modules/users/application/get-admin-users-stats.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('getAdminUsersStats', () => {
  it('counts patrons from distinct active PatronGrant truth instead of User.isPatron cache', async () => {
    const mockPrisma = {
      user: { count: vi.fn() },
      patronGrant: { findMany: vi.fn() },
      payment: { count: vi.fn() },
      comment: { count: vi.fn() },
      userPaymentTotal: { groupBy: vi.fn() },
    };

    mockPrisma.user.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(9);
    mockPrisma.patronGrant.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    mockPrisma.payment.count.mockResolvedValue(7);
    mockPrisma.comment.count.mockResolvedValue(5);
    mockPrisma.userPaymentTotal.groupBy.mockResolvedValue([{ currency: 'PLN', _sum: { amountMinor: 10000 } }]);

    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'admin', userId: 'admin_1' },
    });

    const result = await getAdminUsersStats(ctx);

    expect(mockPrisma.user.count).not.toHaveBeenCalledWith({ where: { isPatron: true } });
    expect(mockPrisma.patronGrant.findMany).toHaveBeenCalledWith({
      where: { revokedAt: null },
      select: { userId: true },
      distinct: ['userId'],
    });
    expect(result.patrons).toBe(2);
    expect(result.patronCountSource).toBe('ACTIVE_PATRON_GRANT');
  });
});
