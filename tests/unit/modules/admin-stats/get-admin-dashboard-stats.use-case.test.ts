import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminDashboardStats } from '@/lib/modules/admin-stats/application/get-admin-dashboard-stats.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('getAdminDashboardStats use case', () => {
  const mockPrisma = {
    user: {
      count: vi.fn(),
    },
    video: {
      count: vi.fn(),
    },
    payment: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const ctx = createAppContext({
    prisma: mockPrisma as any,
    actor: { type: 'admin', userId: 'admin_1' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correctly aggregated statistics', async () => {
    mockPrisma.user.count.mockResolvedValue(150);
    mockPrisma.video.count.mockResolvedValue(42);
    mockPrisma.payment.groupBy.mockResolvedValue([
      { currency: 'PLN', _sum: { amountMinor: 10000 } },
      { currency: 'USD', _sum: { amountMinor: 5000 } },
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 'p1',
        amountMinor: 2000,
        currency: 'PLN',
        status: 'SUCCEEDED',
        createdAt: new Date('2023-10-27T10:00:00Z'),
        user: { email: 'user@example.com', name: 'John Doe' }
      }
    ]);

    const result = await getAdminDashboardStats(ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalUsers).toBe(150);
      expect(result.data.totalVideos).toBe(42);

      expect(result.data.revenueByCurrency).toHaveLength(2);
      expect(result.data.revenueByCurrency).toContainEqual({
        currency: 'PLN',
        amountMinor: 10000,
        amount: 100
      });
      expect(result.data.revenueByCurrency).toContainEqual({
        currency: 'USD',
        amountMinor: 5000,
        amount: 50
      });

      expect(result.data.recentPayments).toHaveLength(1);
      expect(result.data.recentPayments[0]).toMatchObject({
        id: 'p1',
        amount: 20,
        userEmail: 'user@example.com'
      });
    }
  });

  it('handles empty data', async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.video.count.mockResolvedValue(0);
    mockPrisma.payment.groupBy.mockResolvedValue([]);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const result = await getAdminDashboardStats(ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalUsers).toBe(0);
      expect(result.data.totalVideos).toBe(0);
      expect(result.data.revenueByCurrency).toEqual([]);
      expect(result.data.recentPayments).toEqual([]);
    }
  });
});
