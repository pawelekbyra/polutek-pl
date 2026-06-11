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
    mockPrisma.patronGrant.findMany.mockResolvedValue([{ id: 'pg1', source: 'STRIPE_TIP', createdAt: new Date('2023-01-01'), revokedAt: null }]);
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
      expect(result.data.patronDiagnostics.truth.isPatron).toBe(true);
      expect(result.data.patronDiagnostics.finalPatronStatus).toBe('ACTIVE_GRANT');
    }
  });

  it('uses active PatronGrant truth when User.isPatron cache is stale false', async () => {
    const activeGrantCreatedAt = new Date('2024-02-01');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: 'User One',
      username: 'user1',
      role: 'USER',
      isPatron: false,
      isDeleted: false,
      patronSince: null,
      patronSource: null,
      language: 'pl',
      createdAt: new Date('2022-01-01'),
      updatedAt: new Date('2022-01-02'),
      imageUrl: null,
      stripeCustomerId: null,
      referralCode: 'REF123',
      paymentTotals: [],
      _count: { comments: 0, referrals: 0, videoLikes: 0, videoDislikes: 0 },
    });
    mockPrisma.patronGrant.findMany.mockResolvedValue([
      { id: 'pg-active', source: 'ADMIN', createdAt: activeGrantCreatedAt, revokedAt: null },
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await getAdminUserDetails('u1', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isPatron).toBe(false);
      expect(result.data.patronDiagnostics.truth.isPatron).toBe(true);
      expect(result.data.patronDiagnostics.truth.activeGrantIds).toEqual(['pg-active']);
      expect(result.data.patronDiagnostics.finalPatronStatus).toBe('ACTIVE_GRANT');
      expect(result.data.patronDiagnostics.cacheTruthMismatch).toMatchObject({
        hasMismatch: true,
        cacheSaysPatron: false,
        truthSaysPatron: true,
      });
    }
  });

  it('uses no-active-grant truth when User.isPatron cache is stale true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: 'User One',
      username: 'user1',
      role: 'USER',
      isPatron: true,
      isDeleted: false,
      patronSince: new Date('2023-01-01'),
      patronSource: 'STRIPE_TIP',
      language: 'pl',
      createdAt: new Date('2022-01-01'),
      updatedAt: new Date('2022-01-02'),
      imageUrl: null,
      stripeCustomerId: null,
      referralCode: 'REF123',
      paymentTotals: [],
      _count: { comments: 0, referrals: 0, videoLikes: 0, videoDislikes: 0 },
    });
    mockPrisma.patronGrant.findMany.mockResolvedValue([
      { id: 'pg-revoked', source: 'STRIPE_TIP', createdAt: new Date('2023-01-01'), revokedAt: new Date('2024-01-01') },
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await getAdminUserDetails('u1', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isPatron).toBe(true);
      expect(result.data.patronDiagnostics.truth.isPatron).toBe(false);
      expect(result.data.patronDiagnostics.truth.activeGrantCount).toBe(0);
      expect(result.data.patronDiagnostics.finalPatronStatus).toBe('NO_ACTIVE_GRANT');
      expect(result.data.patronDiagnostics.cacheTruthMismatch).toMatchObject({
        hasMismatch: true,
        cacheSaysPatron: true,
        truthSaysPatron: false,
      });
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
