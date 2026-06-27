import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/users/export/route';
import * as authUtils from '@/lib/auth-utils';
import { exportAdminUsers } from '@/lib/modules/users';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/auth-utils', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, requireAdminForApi: vi.fn() };
});

vi.mock('@/lib/modules/users', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    exportAdminUsers: vi.fn(),
  };
});

describe('Admin Users Export Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 if actor is not an admin', async () => {
    vi.mocked(authUtils.requireAdminForApi).mockResolvedValue({
      adminUserId: null,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any,
    });

    const req = new NextRequest('http://localhost/api/admin/users/export');
    const response = await GET(req);

    expect(response.status).toBe(403);
  });

  it('returns CSV content if actor is admin', async () => {
    const adminId = 'admin_1';
    vi.mocked(authUtils.requireAdminForApi).mockResolvedValue({
      adminUserId: adminId,
      response: null,
    });

    const mockUsers = [
      {
        id: 'u1',
        email: 'u1@example.com',
        name: 'User One',
        username: 'user1',
        role: 'USER',
        isPatron: true,
        patronSince: new Date('2023-01-01T12:00:00Z'),
        patronSource: 'STRIPE_TIP',
        normalizedTotal: 100.50,
        language: 'pl',
        isDeleted: false,
        createdAt: new Date('2022-01-01T10:00:00Z'),
      },
    ];

    (exportAdminUsers as any).mockResolvedValue(ok(mockUsers));

    const req = new NextRequest('http://localhost/api/admin/users/export?query=test');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');

    const body = await response.text();
    const rows = body.split('\n');

    expect(rows[0]).toBe('ID,Email,Name,Username,Role,IsPatron,PatronSince,PatronSource,NormalizedTotalPLN,Language,IsDeleted,CreatedAt');
    expect(rows[1]).toContain('"u1"');
    expect(rows[1]).toContain('"u1@example.com"');
    expect(rows[1]).toContain('"User One"');
    expect(rows[1]).toContain('"user1"');
    expect(rows[1]).toContain('"USER"');
    expect(rows[1]).toContain('"true"');
    expect(rows[1]).toContain('"2023-01-01T12:00:00.000Z"');
    expect(rows[1]).toContain('"STRIPE_TIP"');
    expect(rows[1]).toContain('"100.50"');
    expect(rows[1]).toContain('"pl"');
    expect(rows[1]).toContain('"false"');
    expect(rows[1]).toContain('"2022-01-01T10:00:00.000Z"');
  });
});
