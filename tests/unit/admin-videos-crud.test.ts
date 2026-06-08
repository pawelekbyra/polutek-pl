import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { GET, POST, DELETE } from '@/app/api/admin/videos/route';
import { MainChannelService } from '@/lib/channel/main-channel.service';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
    const prismaMock = {
        user: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        video: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          count: vi.fn(),
        },
        videoAsset: {
            findUnique: vi.fn(),
        },
        creator: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        auditLog: {
            create: vi.fn().mockResolvedValue({}),
        },
        $transaction: vi.fn(async (callback) => callback(prismaMock)),
      };
      return { prisma: prismaMock };
});

vi.mock('@/lib/services/user/profile.service', () => ({
  UserProfileService: {
    getOrCreateUser: vi.fn(),
  },
}));

vi.mock('@/lib/channel/main-channel.service', () => ({
    MainChannelService: {
        getRequired: vi.fn(),
    }
}));

describe('Admin Video CRUD API', () => {
  const mainChannel = { id: 'creator_1', slug: 'polutek', isApproved: true, isPrimary: true };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'admin_1' } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN', isDeleted: false } as any);
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mainChannel as any);
  });

  it('allows admin to list videos', async () => {
    vi.mocked(prisma.video.findMany).mockResolvedValue([]);
    vi.mocked(prisma.video.count).mockResolvedValue(0);
    const res = await GET(new NextRequest('http://localhost/api/admin/videos'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('allows admin to create a video', async () => {
    const payload = {
        title: 'New Video',
        slug: 'new-video',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: '/qr-code-placeholder.png',
        status: 'PUBLISHED',
        tier: 'PUBLIC',
        duration: '00:00'
    };
    vi.mocked(prisma.video.create).mockResolvedValue({ id: 'vid_1', ...payload } as any);

    const res = await POST(new NextRequest('http://localhost/api/admin/videos', {
        method: 'POST',
        body: JSON.stringify(payload)
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('vid_1');
  });

  it('blocks non-admin from creating a video', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'USER', isDeleted: false } as any);

    const res = await POST(new NextRequest('http://localhost/api/admin/videos', {
        method: 'POST',
        body: JSON.stringify({})
    }));

    expect(res.status).toBe(403);
  });
});
