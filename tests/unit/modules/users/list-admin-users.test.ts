import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdminUsers } from '@/lib/modules/users/application/list-admin-users.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('listAdminUsers Use Case', () => {
  const mockActor = { type: 'admin' as const, userId: 'admin-1' };
  const ctx = createAppContext({ actor: mockActor, prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  } as any });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return users with full legacy-compatible contract', async () => {
    const mockUser = {
      id: 'u1',
      email: 'u1@example.com',
      name: 'User 1',
      username: 'user1',
      imageUrl: 'http://img.com',
      role: 'USER',
      isPatron: true,
      isDeleted: false,
      patronSince: new Date(),
      patronSource: 'STRIPE_TIP',
      language: 'pl',
      createdAt: new Date(),
      updatedAt: new Date(),
      referralPoints: 10,
      referralCount: 2,
      paymentTotals: [
        { currency: 'PLN', amountMinor: 5000 }
      ],
      _count: {
        payments: 1,
        subscriptions: 1
      },
      payments: [
        { createdAt: new Date() }
      ]
    };

    vi.mocked(ctx.prisma.user.findMany).mockResolvedValue([mockUser] as any);
    vi.mocked(ctx.prisma.user.count).mockResolvedValue(1);

    const result = await listAdminUsers({ page: 1, limit: 10 }, ctx);

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.email).toBe('u1@example.com');
    expect(item.imageUrl).toBe('http://img.com');
    expect(item.hasSubscriptions).toBe(true);
    expect(item.paymentCount).toBe(1);
    expect(item.paymentTotals).toEqual([{ currency: 'PLN', totalPaidMinor: 5000, refundedAmountMinor: 0 }]);
    expect(item.referralPoints).toBe(10);
    expect(item.referralCount).toBe(2);
    expect(item.lastPaymentAt).toBeDefined();
    expect(item.updatedAt).toBeDefined();
  });
});
