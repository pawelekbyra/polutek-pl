import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdminUsers } from '@/lib/modules/users/application/list-admin-users.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('listAdminUsers API contract', () => {
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
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
        paymentTotals: [
          { currency: 'PLN', amountMinor: 10000 }, // 100 PLN
          { currency: 'USD', amountMinor: 5000 },  // 50 USD
        ],
        _count: {
          payments: 5,
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
      hasSubscriptions: true,
      activeGrantSince: new Date('2023-01-01'),
      activeGrantSource: 'STRIPE_TIP',
      activeGrantCount: 1,
      patronTruth: expect.objectContaining({
        isPatron: true,
        activeGrantCount: 1,
        activeGrantSince: new Date('2023-01-01'),
        activeGrantSource: 'STRIPE_TIP',
      }),
    });

    expect(result.items[0].normalizedTotal).toBeGreaterThanOrEqual(100);
  });


  it('maps orderBy=patronSince to grant-backed first active PatronGrant sorting for compatibility, resolved at the DB level', async () => {
    const earlyGrant = new Date('2024-01-01');
    const lateGrant = new Date('2024-03-01');
    const staleCacheDate = new Date('2020-01-01');
    const baseUser = {
      name: null,
      username: null,
      imageUrl: null,
      role: 'USER',
      isDeleted: false,
      language: 'pl',
      updatedAt: new Date('2024-04-01'),
      paymentTotals: [],
      _count: { payments: 0, subscriptions: 0 },
      payments: [],
    };

    const userRecords: Record<string, any> = {
      'u-late-grant-stale-cache': {
        ...baseUser,
        id: 'u-late-grant-stale-cache',
        email: 'late@example.com',
        isPatron: true,
        patronSince: staleCacheDate,
        patronSource: 'LEGACY',
        createdAt: new Date('2022-01-01'),
        patronGrants: [{ id: 'pg-late', source: 'ADMIN', createdAt: lateGrant, revokedAt: null }],
      },
      'u-early-grant': {
        ...baseUser,
        id: 'u-early-grant',
        email: 'early@example.com',
        isPatron: true,
        patronSince: new Date('2023-01-01'),
        patronSource: 'STRIPE_TIP',
        createdAt: new Date('2022-02-01'),
        patronGrants: [{ id: 'pg-early', source: 'STRIPE_TIP', createdAt: earlyGrant, revokedAt: null }],
      },
      'u-cache-only': {
        ...baseUser,
        id: 'u-cache-only',
        email: 'cache-only@example.com',
        isPatron: true,
        patronSince: new Date('2019-01-01'),
        patronSource: 'LEGACY',
        createdAt: new Date('2022-03-01'),
        patronGrants: [],
      },
    };

    // The raw ID-ordering query decides sort order (earliest active grant
    // first); findMany is asked only for these 3 ids, not the whole table,
    // and is stubbed to return them in a different order to prove the use
    // case re-orders by the DB-decided id order rather than trusting
    // whatever order findMany happens to return.
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'u-early-grant' },
      { id: 'u-late-grant-stale-cache' },
      { id: 'u-cache-only' },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      userRecords['u-cache-only'],
      userRecords['u-late-grant-stale-cache'],
      userRecords['u-early-grant'],
    ]);
    mockPrisma.user.count.mockResolvedValue(3);

    const result = await listAdminUsers({ orderBy: 'patronSince', orderDir: 'asc' }, ctx);

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['u-early-grant', 'u-late-grant-stale-cache', 'u-cache-only'] } },
    }));
    // The bounded findMany call must not also carry the unbounded/whole-table
    // shape (no orderBy on a raw column, no separate skip/take here — paging
    // already happened in the raw query above).
    expect(mockPrisma.user.findMany).not.toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { patronSince: 'asc' },
    }));
    expect(result.items.map((item) => item.id)).toEqual([
      'u-early-grant',
      'u-late-grant-stale-cache',
      'u-cache-only',
    ]);
    expect(result.items[1]).toMatchObject({
      patronSince: lateGrant,
      activeGrantSince: lateGrant,
      activeGrantSource: 'ADMIN',
    });
    expect(result.items[2]).toMatchObject({
      activeGrantSince: null,
      activeGrantCount: 0,
      patronTruth: expect.objectContaining({ isPatron: false }),
    });
    expect(result.patronQuerySortContract).toMatchObject({
      patronSinceSortSource: 'ACTIVE_PATRON_GRANT_FIRST_CREATED_AT',
      compatibilityAliases: { orderByPatronSince: 'activeGrantSince' },
    });
  });

  it('supports activeGrantSince as the explicit grant-backed patron sort field', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await listAdminUsers({ orderBy: 'activeGrantSince', orderDir: 'desc' }, ctx);

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    // No matching ids came back, so the second (hydration) findMany call
    // must be skipped entirely rather than fetching with an empty/unbounded
    // filter.
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('bounds the grant-backed sort to one page at the database level (does not fetch the whole filtered table)', async () => {
    // 5 patrons total, but we ask for page 2 of a 2-per-page listing.
    // Only the 2 ids for that page should ever reach findMany.
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'u-page2-a' },
      { id: 'u-page2-b' },
    ]);
    const baseUser = {
      name: null,
      username: null,
      imageUrl: null,
      role: 'USER',
      isDeleted: false,
      isPatron: true,
      patronSource: 'STRIPE_TIP',
      language: 'pl',
      createdAt: new Date('2022-01-01'),
      updatedAt: new Date('2022-01-02'),
      paymentTotals: [],
      _count: { payments: 0, subscriptions: 0 },
      payments: [],
    };
    mockPrisma.user.findMany.mockResolvedValue([
      { ...baseUser, id: 'u-page2-a', email: 'a@example.com', patronSince: new Date('2024-02-01'), patronGrants: [{ id: 'pg-a', source: 'STRIPE_TIP', createdAt: new Date('2024-02-01'), revokedAt: null }] },
      { ...baseUser, id: 'u-page2-b', email: 'b@example.com', patronSince: new Date('2024-03-01'), patronGrants: [{ id: 'pg-b', source: 'STRIPE_TIP', createdAt: new Date('2024-03-01'), revokedAt: null }] },
    ]);
    // Total across the whole filtered set is 5 — much bigger than the 2 ids
    // that should ever be hydrated for this one page.
    mockPrisma.user.count.mockResolvedValue(5);

    const result = await listAdminUsers({ orderBy: 'patronSince', orderDir: 'asc', page: 2, pageSize: 2 }, ctx);

    // The raw query itself must carry this page's bounded LIMIT/OFFSET
    // (pageSize=2, skip=(2-1)*2=2), proving pagination happens in SQL, not
    // in a JS slice over a fully-fetched array.
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    const rawSqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    expect(rawSqlArg.values).toContain(2); // pageSize (LIMIT)
    expect(rawSqlArg.values).toContain(2); // skip (OFFSET) — also 2 for page 2/pageSize 2
    expect(rawSqlArg.sql).toMatch(/LIMIT/);
    expect(rawSqlArg.sql).toMatch(/OFFSET/);

    // findMany must only ever be asked to hydrate the 2 ids this page needs
    // — never the full 5-row filtered table.
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['u-page2-a', 'u-page2-b'] } },
    }));

    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.items.map((item) => item.id)).toEqual(['u-page2-a', 'u-page2-b']);
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
        paymentTotals: [],
        _count: { payments: 0, subscriptions: 0 },
        payments: [],
        patronGrants: [{ id: 'pg-active', source: 'ADMIN', createdAt: new Date('2024-01-01'), revokedAt: null }],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await listAdminUsers({}, ctx);

    expect(result.items[0]).toMatchObject({
      isPatron: true,
      patronTruth: expect.objectContaining({ isPatron: true, activeGrantCount: 1 }),
    });
  });

});
