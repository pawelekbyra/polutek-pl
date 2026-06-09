import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/admin/videos/reorder/route';
import { MainChannelService } from '@/lib/channel/main-channel.service';

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
          findUnique: vi.fn(),
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

vi.mock('@/lib/channel/main-channel.service', () => ({
    MainChannelService: {
        getRequired: vi.fn(),
    }
}));

describe('Admin Video Reorder API', () => {
  const mainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'admin_1' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN', isDeleted: false } as any);
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mainChannel as any);
  });

  it('allows admin to reorder videos belonging to main channel', async () => {
    const payload = {
        videos: [
            { id: 'v1', sidebarOrder: 1, showInSidebar: true, isMainFeatured: true },
            { id: 'v2', sidebarOrder: 2, showInSidebar: true, isMainFeatured: false }
        ]
    };

    vi.mocked(prisma.video.findUnique).mockResolvedValue({ id: 'v1', creatorId: 'c1' } as any);

    const res = await POST(new NextRequest('http://localhost/api/admin/videos/reorder', {
        method: 'POST',
        body: JSON.stringify(payload)
    }));

    expect(res.status).toBe(200);
    expect(prisma.video.update).toHaveBeenCalled();
  });

  it('rejects entire reorder if any video is outside main channel', async () => {
    const payload = {
        videos: [
            { id: 'v1', sidebarOrder: 1, showInSidebar: true, isMainFeatured: false },
            { id: 'v_evil', sidebarOrder: 2, showInSidebar: true, isMainFeatured: false }
        ]
    };

    // First video ok, second is evil
    vi.mocked(prisma.video.findUnique)
        .mockResolvedValueOnce({ id: 'v1', creatorId: 'c1' } as any)
        .mockResolvedValueOnce({ id: 'v_evil', creatorId: 'other' } as any);

    const res = await POST(new NextRequest('http://localhost/api/admin/videos/reorder', {
        method: 'POST',
        body: JSON.stringify(payload)
    }));

    // Should return 500 or 400 depending on error handler, but definitely not success
    expect(res.status).not.toBe(200);
    const data = await res.json();
    expect(data.error).toBe('VIDEO_NOT_ON_MAIN_CHANNEL');
    expect(data.message).toMatch(/does not belong to main channel/);
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
