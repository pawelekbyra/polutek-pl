import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportAdminUsers } from '@/lib/modules/users/application/export-admin-users.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { writeAuditLog } from '@/lib/services/audit.service';

vi.mock('@/lib/services/audit.service', () => ({
  writeAuditLog: vi.fn(),
}));

describe('exportAdminUsers use-case', () => {
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails if actor is not an admin', async () => {
    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'user', userId: 'user_1', isPatron: false },
    });

    const result = await exportAdminUsers({}, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Forbidden');
    }
  });

  it('returns users and calls audit log for admin actor', async () => {
    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'admin', userId: 'admin_1' },
    });

    const mockUsers = [
      {
        id: 'u1',
        email: 'u1@example.com',
        name: 'User One',
        username: 'user1',
        role: 'USER',
        isPatron: true,
        patronSince: new Date('2023-01-01'),
        patronSource: 'STRIPE_TIP',
        language: 'pl',
        isDeleted: false,
        createdAt: new Date('2022-01-01'),
        paymentTotals: [{ currency: 'PLN', amountMinor: 10000 }],
        patronGrants: [{ id: 'pg1', source: 'STRIPE_TIP', createdAt: new Date('2023-01-01'), revokedAt: null }],
      },
    ];

    mockPrisma.user.findMany.mockResolvedValue(mockUsers);

    const result = await exportAdminUsers({ query: 'User' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('u1');
      expect(result.data[0].normalizedTotal).toBe(100);
      expect(result.data[0].patronTruth).toMatchObject({ isPatron: true, activeGrantCount: 1 });
      expect(result.data[0].patronCacheTruthMismatch).toBe(false);
    }

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          {
            OR: [
              { email: { contains: 'User', mode: 'insensitive' } },
              { name: { contains: 'User', mode: 'insensitive' } },
              { username: { contains: 'User', mode: 'insensitive' } },
            ]
          }
        ])
      })
    }));

    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin_1',
      action: 'USERS_EXPORT',
    }));
  });

  it('correctly handles all filters', async () => {
    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'admin', userId: 'admin_1' },
    });

    mockPrisma.user.findMany.mockResolvedValue([]);

    await exportAdminUsers({
      role: 'ADMIN',
      isPatron: true,
      patronSource: 'STRIPE_TIP',
      isDeleted: false,
      language: 'en',
      hasPayments: true,
      hasSubscriptions: true,
    }, ctx);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          {}, // query
          { role: 'ADMIN' },
          { patronGrants: { some: { revokedAt: null } } },
          { language: 'en' },
          { isDeleted: false },
          { patronGrants: { some: { source: 'STRIPE_TIP', revokedAt: null } } },
          { payments: { some: {} } },
          { subscriptions: { some: {} } },
        ]
      }
    }));
  });

  it('exports visible cache/truth mismatch when cache is stale', async () => {
    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'admin', userId: 'admin_1' },
    });

    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u-stale',
        email: 'stale@example.com',
        name: null,
        username: null,
        role: 'USER',
        isPatron: true,
        patronSince: new Date('2023-01-01'),
        patronSource: 'STRIPE_TIP',
        language: 'pl',
        isDeleted: false,
        createdAt: new Date('2022-01-01'),
        paymentTotals: [],
        patronGrants: [],
      },
    ]);

    const result = await exportAdminUsers({}, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        isPatron: true,
        patronTruth: expect.objectContaining({ isPatron: false, activeGrantCount: 0 }),
        patronCacheTruthMismatch: true,
      });
    }
  });

});
