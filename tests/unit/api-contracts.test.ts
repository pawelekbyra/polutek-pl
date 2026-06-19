import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PATCH as languagePATCH } from '@/app/api/user/language/route';
import { GET as subscriptionsGET, POST as subscriptionsPOST, DELETE as subscriptionsDELETE } from '@/app/api/subscriptions/route';
import { GET as mediaSourceGET } from '@/app/api/media-source/[videoId]/route';
import { POST as checkoutIntentPOST } from '@/app/api/checkout/create-intent/route';
import { MainChannelService } from '@/lib/modules/channel';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { GetOrCreateUserUseCase, getOrCreateCurrentUser, updateUserLanguage } from '@/lib/modules/users';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { createCheckoutIntent } from '@/lib/modules/payments';
import { getActorFromAuth } from '@/lib/api/auth';
import { GetSubscriptionStatusUseCase, SubscribeUseCase, UnsubscribeUseCase } from "@/lib/modules/subscriptions";

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creator: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    video: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    videoPlaybackSession: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
    getOptional: vi.fn(),
  },
}));

vi.mock('@/lib/modules/users', () => ({
  updateUserLanguage: vi.fn(),
  getOrCreateCurrentUser: vi.fn(),
  GetOrCreateUserUseCase: {
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/services/playback/playback.service', () => ({
  PlaybackService: {
    createPlaybackPlanWithContext: vi.fn(),
  },
}));

vi.mock('@/lib/modules/payments', () => ({
  createCheckoutIntent: vi.fn(),
}));

vi.mock('@/lib/modules/subscriptions', () => ({
    GetSubscriptionStatusUseCase: { execute: vi.fn() },
    SubscribeUseCase: { execute: vi.fn() },
    UnsubscribeUseCase: { execute: vi.fn() },
}));

// Mock rateLimit to always succeed
vi.mock('@/lib/rate-limit', () => ({
    rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe('API Contracts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ALLOWED_MEDIA_HOSTS: 'media.example.com' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('PATCH /api/user/language', () => {
    it('matches the documented response shape for success', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1', sessionClaims: { metadata: { role: 'user' } } } as any);
      vi.mocked(updateUserLanguage).mockResolvedValue({} as any);

      const req = new NextRequest('http://localhost/api/user/language', {
        method: 'PATCH',
        body: JSON.stringify({ language: 'pl' }),
      });

      const res = await languagePATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it('matches the documented response shape for unauthorized', async () => {
        vi.mocked(auth).mockResolvedValue({ userId: null } as any);

        const req = new NextRequest('http://localhost/api/user/language', {
          method: 'PATCH',
          body: JSON.stringify({ language: 'pl' }),
        });

        const res = await languagePATCH(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data).toEqual({ error: "Unauthorized" });
      });
  });

  describe('/api/subscriptions', () => {
    it('GET matches the documented response shape', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1' } as any);
      vi.mocked(auth).mockResolvedValue({ sessionClaims: { email: 'test@example.com' } } as any);
      vi.mocked(GetOrCreateUserUseCase.execute).mockResolvedValue({ id: 'user_1' } as any);

      const mockResult = {
        isSubscribed: true,
        subscribedAt: '2024-01-01T00:00:00.000Z',
        subscribersCount: 10,
        creatorId: 'creator_1',
        creatorSlug: 'creator-slug',
        purpose: 'EMAIL_NOTIFICATIONS',
      };

      vi.mocked(GetSubscriptionStatusUseCase.execute).mockResolvedValue(mockResult as any);

      const req = new NextRequest('http://localhost/api/subscriptions?creatorId=creator_1');
      const res = await subscriptionsGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(mockResult);
    });

    it('POST matches the documented response shape', async () => {
        vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1' } as any);
        vi.mocked(auth).mockResolvedValue({ sessionClaims: { email: 'test@example.com' } } as any);
        vi.mocked(GetOrCreateUserUseCase.execute).mockResolvedValue({ id: 'user_1' } as any);

        const mockResult = {
            isSubscribed: true,
            subscribedAt: '2024-01-01T00:00:00.000Z',
            subscribersCount: 11,
            creatorId: 'creator_1',
            creatorSlug: 'creator-slug',
            purpose: 'EMAIL_NOTIFICATIONS',
            message: 'Email notifications enabled for this channel.',
        };
        vi.mocked(SubscribeUseCase.execute).mockResolvedValue(mockResult as any);

        const req = new NextRequest('http://localhost/api/subscriptions', {
          method: 'POST',
          body: JSON.stringify({ creatorId: 'creator_1' }),
        });
        const res = await subscriptionsPOST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual(mockResult);
    });

    it('DELETE matches the documented response shape', async () => {
        vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1' } as any);
        vi.mocked(auth).mockResolvedValue({ sessionClaims: { email: 'test@example.com' } } as any);
        vi.mocked(GetOrCreateUserUseCase.execute).mockResolvedValue({ id: 'user_1' } as any);

        const mockResult = {
            isSubscribed: false,
            deleted: true,
            subscribersCount: 10,
            creatorId: 'creator_1',
            creatorSlug: 'creator-slug',
            purpose: 'EMAIL_NOTIFICATIONS',
            message: 'Email notifications disabled for this channel.',
        };
        vi.mocked(UnsubscribeUseCase.execute).mockResolvedValue(mockResult as any);

        const req = new NextRequest('http://localhost/api/subscriptions?creatorId=creator_1', {
          method: 'DELETE',
        });
        const res = await subscriptionsDELETE(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual(mockResult);
    });
  });

  describe('GET /api/media-source/[videoId]', () => {
    it('matches the documented response shape for success', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1' } as any);

      const mockPlaybackPlan = {
          access: { allowed: true },
          source: {
              kind: 'direct',
              playbackUrl: '/api/media/v1',
          },
          diagnostics: { warnings: [] },
          tracking: {}
      };

      vi.mocked(PlaybackService.createPlaybackPlanWithContext).mockResolvedValue(mockPlaybackPlan as any);

      const req = new NextRequest('http://localhost/api/media-source/v1');
      const res = await mediaSourceGET(req, { params: Promise.resolve({ videoId: 'v1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        hasAccess: true,
        kind: 'direct',
        playbackUrl: '/api/media/v1',
      });
    });

    it('matches the documented response shape for forbidden', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1' } as any);

      const mockPlaybackPlan = {
          access: { allowed: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' },
          diagnostics: { warnings: [] },
          tracking: {}
      };

      vi.mocked(PlaybackService.createPlaybackPlanWithContext).mockResolvedValue(mockPlaybackPlan as any);

      const req = new NextRequest('http://localhost/api/media-source/v1');
      const res = await mediaSourceGET(req, { params: Promise.resolve({ videoId: 'v1' }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data).toMatchObject({
        hasAccess: false,
        access: {
            reason: 'PATRON_REQUIRED',
            requiredTier: 'PATRON'
        }
      });
    });
  });

  describe('POST /api/checkout/create-intent', () => {
    it('matches the documented response shape', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(getOrCreateCurrentUser).mockResolvedValue({ id: 'user_1', isPatron: false } as any);
      vi.mocked(createCheckoutIntent).mockResolvedValue({
          ok: true,
          data: { paymentId: 'pay_1', clientSecret: 'secret_1' }
      } as any);

      const req = new NextRequest('http://localhost/api/checkout/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          amountMinor: 2000,
          currency: 'PLN',
          title: 'Tip',
          requestId: '00000000-0000-0000-0000-000000000000'
        }),
      });

      const res = await checkoutIntentPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        clientSecret: 'secret_1',
        paymentId: 'pay_1'
      });
    });
  });
});
