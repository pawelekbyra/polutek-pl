import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/admin/videos/reorder/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
    const prismaMock = {
        user: {
          findUnique: vi.fn(),
        },
        video: {
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        auditLog: {
            create: vi.fn().mockResolvedValue({}),
        },
        $transaction: vi.fn(async (callback) => callback(prismaMock)),
      };
      return { prisma: prismaMock };
});

describe('Admin Video Reorder API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'admin_1' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN', isDeleted: false } as any);
  });

  it('allows admin to reorder videos', async () => {
    const payload = {
        videos: [
            { id: 'v1', sidebarOrder: 1, showInSidebar: true, isMainFeatured: true },
            { id: 'v2', sidebarOrder: 2, showInSidebar: true, isMainFeatured: false }
        ]
    };

    const res = await POST(new NextRequest('http://localhost/api/admin/videos/reorder', {
        method: 'POST',
        body: JSON.stringify(payload)
    }));

    expect(res.status).toBe(200);
    expect(prisma.video.update).toHaveBeenCalledTimes(2);
    expect(prisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: { not: 'v1' } },
        data: { isMainFeatured: false }
    }));
  });

  it('blocks unauthorized access', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'USER', isDeleted: false } as any);

    const res = await POST(new NextRequest('http://localhost/api/admin/videos/reorder', {
        method: 'POST',
        body: JSON.stringify({ videos: [] })
    }));

    expect(res.status).toBe(403);
  });
});
