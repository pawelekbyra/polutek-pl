import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE, PATCH } from '@/app/api/subscriptions/route';
import { getActorFromAuth } from '@/lib/api/auth';
import { auth } from '@/lib/auth/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  GetSubscriptionStatusUseCase,
  SetSubscriptionNotifyUseCase,
  SubscribeUseCase,
  UnsubscribeUseCase,
} from '@/lib/modules/subscriptions';
import { AppError } from '@/lib/modules/shared/app-error';

vi.mock('@/lib/api/auth');
vi.mock('@/lib/auth/server');
vi.mock('@/lib/rate-limit');
vi.mock('@/lib/modules/subscriptions', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/lib/modules/subscriptions/domain/subscription-input')),
  GetSubscriptionStatusUseCase: { execute: vi.fn() },
  SubscribeUseCase: { execute: vi.fn() },
  UnsubscribeUseCase: { execute: vi.fn() },
  SetSubscriptionNotifyUseCase: { execute: vi.fn() },
}));
vi.mock('@/lib/modules/users', () => ({ getOrCreateCurrentUser: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  createScopedLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

const URL_ = 'http://localhost/api/subscriptions';
const json = (method: string, body: unknown) =>
  new NextRequest(URL_, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('/api/subscriptions addresses a channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1' } as any);
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1', user: { email: 'a@example.com', emailVerified: true } } as any);
  });

  it('GET passes creatorId from the query string', async () => {
    vi.mocked(GetSubscriptionStatusUseCase.execute).mockResolvedValue({ isSubscribed: false } as any);

    const res = await GET(new NextRequest(`${URL_}?creatorId=chan_2`));

    expect(res.status).toBe(200);
    expect(GetSubscriptionStatusUseCase.execute).toHaveBeenCalledWith(expect.anything(), { creatorId: 'chan_2' });
  });

  it('GET without creatorId keeps the main channel (back-compat)', async () => {
    vi.mocked(GetSubscriptionStatusUseCase.execute).mockResolvedValue({ isSubscribed: false } as any);

    await GET(new NextRequest(URL_));

    expect(GetSubscriptionStatusUseCase.execute).toHaveBeenCalledWith(expect.anything(), { creatorId: undefined });
  });

  it('POST passes creatorId from the JSON body', async () => {
    vi.mocked(SubscribeUseCase.execute).mockResolvedValue({ isSubscribed: true } as any);

    const res = await POST(json('POST', { creatorId: 'chan_2' }));

    expect(res.status).toBe(200);
    expect(SubscribeUseCase.execute).toHaveBeenCalledWith(expect.anything(), { trustedEmail: 'a@example.com', creatorId: 'chan_2' });
  });

  it('DELETE passes creatorId from the JSON body', async () => {
    vi.mocked(UnsubscribeUseCase.execute).mockResolvedValue({ isSubscribed: false } as any);

    const res = await DELETE(json('DELETE', { creatorId: 'chan_2' }));

    expect(res.status).toBe(200);
    expect(UnsubscribeUseCase.execute).toHaveBeenCalledWith(expect.anything(), { trustedEmail: 'a@example.com', creatorId: 'chan_2' });
  });

  it.each([
    ['unknown key', { creatorId: 'chan_2', extra: 1 }],
    ['not a string', { creatorId: 42 }],
    ['invalid characters', { creatorId: "x'; DROP TABLE" }],
    ['too long', { creatorId: 'a'.repeat(65) }],
    ['array body', ['chan_2']],
  ])('POST rejects a body with %s (400, no use case call)', async (_name, body) => {
    const res = await POST(json('POST', body));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_REQUEST');
    expect(SubscribeUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST rejects a body that is not JSON', async () => {
    const res = await POST(new NextRequest(URL_, { method: 'POST', body: '{nope' }));

    expect(res.status).toBe(400);
    expect(SubscribeUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET rejects an invalid creatorId query', async () => {
    const res = await GET(new NextRequest(`${URL_}?creatorId=${encodeURIComponent('a b')}`));

    expect(res.status).toBe(400);
    expect(GetSubscriptionStatusUseCase.execute).not.toHaveBeenCalled();
  });

  it('maps a hidden or missing channel (404 from the use case) to HTTP 404', async () => {
    vi.mocked(SubscribeUseCase.execute).mockRejectedValue(new AppError('Channel "x" not found.', 404, 'CHANNEL_NOT_FOUND'));

    const res = await POST(json('POST', { creatorId: 'hidden' }));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('CHANNEL_NOT_FOUND');
  });

  describe('PATCH (the bell)', () => {
    it('switches notifications of one channel', async () => {
      vi.mocked(SetSubscriptionNotifyUseCase.execute).mockResolvedValue({ creatorId: 'chan_2', notify: false } as any);

      const res = await PATCH(json('PATCH', { creatorId: 'chan_2', notify: false }));

      expect(res.status).toBe(200);
      expect(SetSubscriptionNotifyUseCase.execute).toHaveBeenCalledWith(expect.anything(), { creatorId: 'chan_2', notify: false });
    });

    it('does not need an e-mail claim (consent is not touched)', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1', user: null } as any);
      vi.mocked(SetSubscriptionNotifyUseCase.execute).mockResolvedValue({ notify: true } as any);

      const res = await PATCH(json('PATCH', { notify: true }));

      expect(res.status).toBe(200);
    });

    it.each([
      ['missing notify', { creatorId: 'chan_2' }],
      ['notify as string', { creatorId: 'chan_2', notify: 'no' }],
      ['unknown key', { notify: true, userId: 'someone_else' }],
    ])('rejects %s with 400', async (_name, body) => {
      const res = await PATCH(json('PATCH', body));

      expect(res.status).toBe(400);
      expect(SetSubscriptionNotifyUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 401 for guests', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);

      const res = await PATCH(json('PATCH', { notify: true }));

      expect(res.status).toBe(401);
      expect(SetSubscriptionNotifyUseCase.execute).not.toHaveBeenCalled();
    });

    it('is rate limited like other writes', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false } as any);

      const res = await PATCH(json('PATCH', { notify: true }));

      expect(res.status).toBe(429);
    });

    it('maps a missing subscription (404) through', async () => {
      vi.mocked(SetSubscriptionNotifyUseCase.execute).mockRejectedValue(
        new AppError('You are not subscribed to this channel.', 404, 'SUBSCRIPTION_NOT_FOUND'),
      );

      const res = await PATCH(json('PATCH', { notify: false }));

      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe('SUBSCRIPTION_NOT_FOUND');
    });
  });
});
