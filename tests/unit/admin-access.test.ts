import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/lib/services/user.service';
import { requireAdminForApi } from '@/lib/auth-utils';
import { GET as getAdminStats } from '@/app/api/admin/stats/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    video: {
      count: vi.fn(),
    },
    payment: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/user.service', () => ({
  UserService: {
    getOrCreateUser: vi.fn(),
  },
}));

describe('admin API access protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAIL = 'admin@example.com';
    vi.mocked(UserService.getOrCreateUser).mockResolvedValue({ id: 'user_1' } as never);
  });

  it('returns 401 for guests before any admin database reads', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const { adminUserId, response } = await requireAdminForApi('TEST_ADMIN_GUEST');

    expect(adminUserId).toBeNull();
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: 'Unauthorized' });
    expect(UserService.getOrCreateUser).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin users', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: 'USER',
      isDeleted: false,
      email: 'viewer@example.com',
    } as never);

    const { adminUserId, response } = await requireAdminForApi('TEST_ADMIN_FORBIDDEN');

    expect(adminUserId).toBeNull();
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: 'Forbidden' });
  });

  it('allows existing ADMIN users', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'admin_1' } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: 'ADMIN',
      isDeleted: false,
      email: 'owner@example.com',
    } as never);

    const { adminUserId, response } = await requireAdminForApi('TEST_ADMIN_ALLOWED');

    expect(adminUserId).toBe('admin_1');
    expect(response).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('bootstraps the configured ADMIN_EMAIL only after an authenticated database user match', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'admin_1' } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: 'USER',
      isDeleted: false,
      email: 'admin@example.com',
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const { adminUserId, response } = await requireAdminForApi('TEST_ADMIN_BOOTSTRAP');

    expect(adminUserId).toBe('admin_1');
    expect(response).toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'admin_1' },
      data: { role: 'ADMIN' },
    });
  });

  it('protects representative admin API routes before route-specific work starts', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: 'USER',
      isDeleted: false,
      email: 'viewer@example.com',
    } as never);

    const response = await getAdminStats(new NextRequest('http://localhost/api/admin/stats'));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.video.count).not.toHaveBeenCalled();
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
  });
});
