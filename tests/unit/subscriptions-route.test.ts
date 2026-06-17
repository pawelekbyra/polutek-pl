import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { GET, POST, DELETE } from '@/app/api/subscriptions/route';
import { GetSubscriptionStatusUseCase, SubscribeUseCase, UnsubscribeUseCase } from '@/lib/modules/subscriptions';
import { GetOrCreateUserUseCase } from '@/lib/modules/users';
import { getActorFromAuth } from '@/lib/api/auth';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/subscriptions', () => ({
  GetSubscriptionStatusUseCase: { execute: vi.fn() },
  SubscribeUseCase: { execute: vi.fn() },
  UnsubscribeUseCase: { execute: vi.fn() },
}));

vi.mock('@/lib/modules/users', () => ({
  GetOrCreateUserUseCase: { execute: vi.fn() },
}));

describe('/api/subscriptions', () => {
  const mockStatus = {
    isSubscribed: true,
    subscribedAt: new Date('2026-01-01T00:00:00Z'),
    subscribersCount: 10,
    creatorId: 'c1',
    creatorSlug: 'polutek',
    purpose: 'EMAIL_NOTIFICATIONS',
  };

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
    vi.mocked(getActorFromAuth).mockResolvedValue({
      type: 'user',
      userId: 'user_1',
      isPatron: false,
    } as any);
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 119 });
  });

  it('returns 401 for guests so the client can open Clerk sign-in', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(GetSubscriptionStatusUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns the email notification subscription status for a logged-in user', async () => {
    vi.mocked(GetSubscriptionStatusUseCase.execute).mockResolvedValue(mockStatus as any);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(true);
    expect(body.creatorId).toBe('c1');
    expect(GetSubscriptionStatusUseCase.execute).toHaveBeenCalled();
  });

  it('creates a Subscription as email notifications only for main channel', async () => {
    vi.mocked(SubscribeUseCase.execute).mockResolvedValue({
      ...mockStatus,
      message: 'Email notifications enabled for this channel.',
    } as any);

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', {
      method: 'POST',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(true);
    expect(body.creatorId).toBe('c1');
    expect(SubscribeUseCase.execute).toHaveBeenCalled();
  });

  it('removes email notifications for main channel', async () => {
    vi.mocked(UnsubscribeUseCase.execute).mockResolvedValue({
      isSubscribed: false,
      deleted: true,
      subscribersCount: 9,
      creatorId: 'c1',
      creatorSlug: 'polutek',
      purpose: 'EMAIL_NOTIFICATIONS',
      message: 'Email notifications disabled for this channel.',
    } as any);

    const res = await DELETE(new NextRequest('http://localhost/api/subscriptions', {
      method: 'DELETE',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isSubscribed).toBe(false);
    expect(body.creatorId).toBe('c1');
    expect(UnsubscribeUseCase.execute).toHaveBeenCalled();
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
});
