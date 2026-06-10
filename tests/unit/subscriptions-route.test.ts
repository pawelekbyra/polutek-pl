import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { rateLimit } from '@/lib/rate-limit';
import { GET, POST, DELETE } from '@/app/api/subscriptions/route';
import { MainChannelService } from '@/lib/channel/main-channel.service';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  creator: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback) => callback(prismaMock)),
    ...prismaMock,
  },
}));


vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/channel/main-channel.service', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

describe('/api/subscriptions', () => {
  const mainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        sessionClaims: {
            email: 'user1@example.com',
            name: 'User One',
            username: 'user1',
            image_url: 'http://example.com/image.png'
        }
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user_1', isPatron: false } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user_1', isPatron: false } as any);
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 119 });
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mainChannel as any);
    vi.mocked(prisma.creator.findUnique).mockResolvedValue(mainChannel as any);
  });

  it('returns 401 for guests so the client can open Clerk sign-in', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('returns the email notification subscription status for a logged-in user for main channel', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({ id: 'sub_1', createdAt } as any);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(true);
    expect(body.creatorId).toBe('c1');
    expect(body.purpose).toBe('EMAIL_NOTIFICATIONS');
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId_creatorId: { userId: 'user_1', creatorId: 'c1' } },
      select: { id: true, createdAt: true },
    });
  });

  it('creates a Subscription as email notifications only for main channel', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub_1', createdAt } as any);
    vi.mocked(prisma.creator.update).mockResolvedValue({} as any);

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', {
      method: 'POST',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(true);
    expect(body.creatorId).toBe('c1');
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: { userId: 'user_1', creatorId: 'c1' },
      select: { id: true, createdAt: true },
    });
    expect(prisma.creator.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { subscribersCount: { increment: 1 } },
    });
  });

  it('removes email notifications for main channel', async () => {
    vi.mocked(prisma.subscription.deleteMany).mockResolvedValue({ count: 1 } as any);

    const res = await DELETE(new NextRequest('http://localhost/api/subscriptions', {
      method: 'DELETE',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(false);
    expect(body.creatorId).toBe('c1');
    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', creatorId: 'c1' },
    });
  });

  it('rate limits logged-in subscription mutations', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0 });

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', {
      method: 'POST',
    }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('RATE_LIMITED');
  });

  it('fails if main channel is missing', async () => {
    vi.mocked(MainChannelService.getRequired).mockRejectedValue(new Error('Main channel missing'));

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', {
      method: 'POST',
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
  });
});
