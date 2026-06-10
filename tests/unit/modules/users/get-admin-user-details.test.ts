import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminUserDetails } from '@/lib/modules/users/application/get-admin-user-details.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { UserNotFoundError } from '@/lib/modules/users/domain/user.errors';

vi.mock('@/lib/modules/audit', () => ({
  getAuditLogs: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

describe('getAdminUserDetails Use Case', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
      patronGrant: {
        findMany: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
      },
      subscription: {
        findMany: vi.fn(),
      }
    };
  });

  it('returns consolidated user details', async () => {
    const user = {
      id: 'u1',
      email: 'user@example.com',
      name: 'User One',
      username: 'user1',
      role: 'USER',
      isPatron: true,
      isDeleted: false,
      patronSince: new Date(),
      patronSource: 'STRIPE',
      language: 'pl',
      createdAt: new Date(),
      updatedAt: new Date(),
      imageUrl: 'https://example.com/image.png',
      stripeCustomerId: 'cus_123',
      referralCode: 'REF123',
      paymentTotals: [{ currency: 'PLN', amountMinor: 10000 }],
      _count: {
          comments: 5,
          referrals: 2,
          videoLikes: 10,
          videoDislikes: 1
      }
    };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockPrisma.patronGrant.findMany.mockResolvedValue([{ id: 'pg1' }]);
    mockPrisma.payment.findMany.mockResolvedValue([{ id: 'p1' }]);
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: 's1', creator: { id: 'c1' } }]);

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await getAdminUserDetails('u1', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('u1');
      expect(result.data.paymentTotals).toHaveLength(1);
      expect(result.data.patronGrants).toHaveLength(1);
      expect(result.data.payments).toHaveLength(1);
      expect(result.data.subscriptions).toHaveLength(1);
      expect(result.data.normalizedTotal).toBe(100);
      expect(result.data.auditLogs).toBeDefined();
    }
  });

  it('returns fail(UserNotFoundError) when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await getAdminUserDetails('u1', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(UserNotFoundError);
    }
  });
});
