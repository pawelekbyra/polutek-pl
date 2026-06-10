import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { GET, POST, DELETE } from '@/app/api/subscriptions/route';
import {
  GetSubscriptionStatusUseCase,
  SubscribeUseCase,
  UnsubscribeUseCase,
  GetOrCreateUserUseCase
} from '@/lib/modules/users';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock('@/lib/modules/users', () => ({
  GetSubscriptionStatusUseCase: { execute: vi.fn() },
  SubscribeUseCase: { execute: vi.fn() },
  UnsubscribeUseCase: { execute: vi.fn() },
  GetOrCreateUserUseCase: { execute: vi.fn() },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

describe('/api/subscriptions (Refactored)', () => {
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
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 119 });
    vi.mocked(GetOrCreateUserUseCase.execute).mockResolvedValue({ id: 'user_1' } as any);
  });

  it('returns 401 for guests', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('GET calls GetSubscriptionStatusUseCase', async () => {
    const mockStatus = { isSubscribed: true, subscribersCount: 10 };
    vi.mocked(GetSubscriptionStatusUseCase.execute).mockResolvedValue(mockStatus as any);

    const res = await GET(new NextRequest('http://localhost/api/subscriptions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(mockStatus);
    expect(GetSubscriptionStatusUseCase.execute).toHaveBeenCalled();
  });

  it('POST calls SubscribeUseCase', async () => {
    const mockResult = { isSubscribed: true, message: 'Subscribed' };
    vi.mocked(SubscribeUseCase.execute).mockResolvedValue(mockResult as any);

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', { method: 'POST' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(mockResult);
    expect(SubscribeUseCase.execute).toHaveBeenCalled();
  });

  it('DELETE calls UnsubscribeUseCase', async () => {
    const mockResult = { isSubscribed: false, deleted: true };
    vi.mocked(UnsubscribeUseCase.execute).mockResolvedValue(mockResult as any);

    const res = await DELETE(new NextRequest('http://localhost/api/subscriptions', { method: 'DELETE' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(mockResult);
    expect(UnsubscribeUseCase.execute).toHaveBeenCalled();
  });

  it('rate limits mutations', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0 });

    const res = await POST(new NextRequest('http://localhost/api/subscriptions', { method: 'POST' }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('RATE_LIMITED');
  });
});
