import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/lib/services/user.service';
import { rateLimit } from '@/lib/rate-limit';
import { GET, POST, DELETE } from '@/app/api/subscriptions/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creator: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/user.service', () => ({
  UserService: {
    getOrCreateUser: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

describe('/api/subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(UserService.getOrCreateUser).mockResolvedValue({ id: 'user_1' } as any);
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 119 });
    vi.mocked(prisma.creator.findUnique).mockResolvedValue({ id: 'creator_1', slug: 'creator-slug', isApproved: true } as any);
  });

  it('returns 401 for guests so the client can open Clerk sign-in', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions?creatorId=creator_1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('returns the email notification subscription status for a logged-in user', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({ id: 'sub_1', createdAt } as any);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions?creatorSlug=creator-slug'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(true);
    expect(body.purpose).toBe('EMAIL_NOTIFICATIONS');
    expect(prisma.creator.findUnique).toHaveBeenCalledWith({
      where: { slug: 'creator-slug' },
      select: { id: true, slug: true, isApproved: true },
    });
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId_creatorId: { userId: 'user_1', creatorId: 'creator_1' } },
      select: { id: true, createdAt: true },
    });
  });

  it('creates a Subscription as email notifications only and never grants Patron access', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({ id: 'sub_1', createdAt } as any);

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ creatorId: 'creator_1' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(true);
    expect(body.purpose).toBe('EMAIL_NOTIFICATIONS');
    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { userId_creatorId: { userId: 'user_1', creatorId: 'creator_1' } },
      update: {},
      create: { userId: 'user_1', creatorId: 'creator_1' },
      select: { id: true, createdAt: true },
    });
    expect(JSON.stringify(vi.mocked(prisma.subscription.upsert).mock.calls)).not.toContain('isPatron');
  });

  it('removes email notifications without touching Patron access', async () => {
    vi.mocked(prisma.subscription.deleteMany).mockResolvedValue({ count: 1 } as any);

    const res = await DELETE(new NextRequest('http://localhost/api/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ creatorId: 'creator_1' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(false);
    expect(body.deleted).toBe(true);
    expect(body.purpose).toBe('EMAIL_NOTIFICATIONS');
    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', creatorId: 'creator_1' },
    });
    expect(JSON.stringify(vi.mocked(prisma.subscription.deleteMany).mock.calls)).not.toContain('isPatron');
  });



  it('rate limits logged-in subscription mutations before database writes', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0 });

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ creatorId: 'creator_1' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('RATE_LIMITED');
    expect(rateLimit).toHaveBeenCalledWith({
      key: 'subscriptions:write:user_1',
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('rejects non-existing or unapproved creators', async () => {
    vi.mocked(prisma.creator.findUnique).mockResolvedValue(null);

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ creatorId: 'missing_creator' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('CREATOR_NOT_FOUND');
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });
});
