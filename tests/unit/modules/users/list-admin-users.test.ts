import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdminUsers } from '@/lib/modules/users/application/list-admin-users.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('listAdminUsers API contract', () => {
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  const ctx = createAppContext({
    prisma: mockPrisma as any,
    actor: { type: 'admin', userId: 'admin_1' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('respects pageSize and page in query', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(100);

    const result = await listAdminUsers({ page: 2, pageSize: 10 }, ctx);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
    }));
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(10);
  });

  it('respects orderDir (desc) for sorting', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await listAdminUsers({ orderBy: 'email', orderDir: 'desc' }, ctx);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { email: 'desc' },
    }));
  });

  it('respects orderDir (asc) for sorting', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await listAdminUsers({ orderBy: 'name', orderDir: 'asc' }, ctx);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { name: 'asc' },
    }));
  });

  it('returns items with normalizedTotal and required fields', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'u1@example.com',
        name: 'User One',
        username: 'user1',
        imageUrl: 'http://img.com',
        role: 'USER',
        isPatron: true,
        isDeleted: false,
        patronSince: new Date('2023-01-01'),
        patronSource: 'STRIPE_TIP',
        language: 'pl',
        createdAt: new Date('2022-01-01'),
        updatedAt: new Date('2022-01-02'),
        referralPoints: 10,
        paymentTotals: [
          { currency: 'PLN', amountMinor: 10000 }, // 100 PLN
          { currency: 'USD', amountMinor: 5000 },  // 50 USD
        ],
        _count: {
          payments: 5,
          referrals: 2,
          subscriptions: 1,
        },
        payments: [{ createdAt: new Date('2023-06-01') }],
        patronGrants: [{ id: 'pg1', source: 'STRIPE_TIP', createdAt: new Date('2023-01-01'), revokedAt: null }],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await listAdminUsers({}, ctx);

    expect(result.items[0]).toMatchObject({
      id: 'u1',
      email: 'u1@example.com',
      normalizedTotal: expect.any(Number),
      paymentCount: 5,
      referralCount: 2,
      hasSubscriptions: true,
      patronTruth: expect.objectContaining({ isPatron: true, activeGrantCount: 1 }),
      patronCache: expect.objectContaining({ isPatron: true, readModelSource: 'USER_PATRON_CACHE' }),
      patronCacheTruthMismatch: false,
    });

    expect(result.items[0].normalizedTotal).toBeGreaterThanOrEqual(100);
  });

  it('uses active PatronGrant-backed filters for patron status and source', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await listAdminUsers({ isPatron: true, patronSource: 'ADMIN' }, ctx);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: expect.arrayContaining([
          { patronGrants: { some: { revokedAt: null } } },
          { patronGrants: { some: { source: 'ADMIN', revokedAt: null } } },
        ]),
      },
    }));
  });

  it('returns cache/truth mismatch while preserving cache fields in list DTO', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u-cache-stale',
        email: 'stale@example.com',
        name: null,
        username: null,
        imageUrl: null,
        role: 'USER',
        isPatron: false,
        isDeleted: false,
        patronSince: null,
        patronSource: null,
        language: 'pl',
        createdAt: new Date('2022-01-01'),
        updatedAt: new Date('2022-01-02'),
        referralPoints: 0,
        paymentTotals: [],
        _count: { payments: 0, referrals: 0, subscriptions: 0 },
        payments: [],
        patronGrants: [{ id: 'pg-active', source: 'ADMIN', createdAt: new Date('2024-01-01'), revokedAt: null }],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await listAdminUsers({}, ctx);

    expect(result.items[0]).toMatchObject({
      isPatron: false,
      patronTruth: expect.objectContaining({ isPatron: true, activeGrantCount: 1 }),
      patronCacheTruthMismatch: true,
    });
  });

});
