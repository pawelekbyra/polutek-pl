import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PATCH as languagePATCH } from '@/app/api/user/language/route';
import { GET as subscriptionsGET, POST as subscriptionsPOST, DELETE as subscriptionsDELETE } from '@/app/api/subscriptions/route';
import { GET as mediaSourceGET } from '@/app/api/media-source/[videoId]/route';
import { POST as checkoutIntentPOST } from '@/app/api/checkout/create-intent/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';
import { PaymentService } from '@/lib/services/payment.service';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
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
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/services/user.service', () => ({
  UserService: {
    updateUserLanguage: vi.fn(),
    toggleSubscription: vi.fn(),
    getSubscriptionStatus: vi.fn(),
    getOrCreateUser: vi.fn(),
  },
}));

vi.mock('@/lib/access/access-policy', () => ({
    AccessPolicy: {
        canViewVideo: vi.fn(),
    },
}));

vi.mock('@/lib/services/payment.service', () => ({
    PaymentService: {
        createPayment: vi.fn(),
    },
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
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(UserService.updateUserLanguage).mockResolvedValue({} as any);

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
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(UserService.getOrCreateUser).mockResolvedValue({ id: 'user_1' } as any);
      vi.mocked(prisma.creator.findUnique).mockResolvedValue({ id: 'creator_1', slug: 'creator-slug', isApproved: true } as any);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({ id: 'sub_1', createdAt: '2024-01-01T00:00:00.000Z' } as any);

      const req = new NextRequest('http://localhost/api/subscriptions?creatorId=creator_1');
      const res = await subscriptionsGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        isSubscribed: true,
        subscribedAt: '2024-01-01T00:00:00.000Z',
        creatorId: 'creator_1',
        creatorSlug: 'creator-slug',
        purpose: 'EMAIL_NOTIFICATIONS',
      });
    });

    it('POST matches the documented response shape', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(UserService.getOrCreateUser).mockResolvedValue({ id: 'user_1' } as any);
      vi.mocked(prisma.creator.findUnique).mockResolvedValue({ id: 'creator_1', slug: 'creator-slug', isApproved: true } as any);

      vi.mocked(prisma.$transaction).mockResolvedValue({ id: 'sub_1', createdAt: '2024-01-01T00:00:00.000Z' } as any);

      const req = new NextRequest('http://localhost/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ creatorId: 'creator_1' }),
      });
      const res = await subscriptionsPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        isSubscribed: true,
        subscribedAt: '2024-01-01T00:00:00.000Z',
        creatorId: 'creator_1',
        creatorSlug: 'creator-slug',
        purpose: 'EMAIL_NOTIFICATIONS',
        message: 'Email notifications enabled for this channel.',
      });
    });

    it('DELETE matches the documented response shape', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(UserService.getOrCreateUser).mockResolvedValue({ id: 'user_1' } as any);
      vi.mocked(prisma.creator.findUnique).mockResolvedValue({ id: 'creator_1', slug: 'creator-slug', isApproved: true } as any);
      vi.mocked(prisma.$transaction).mockResolvedValue({ count: 1 } as any);

      const req = new NextRequest('http://localhost/api/subscriptions?creatorId=creator_1', {
        method: 'DELETE',
      });
      const res = await subscriptionsDELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        isSubscribed: false,
        deleted: true,
        creatorId: 'creator_1',
        creatorSlug: 'creator-slug',
        purpose: 'EMAIL_NOTIFICATIONS',
        message: 'Email notifications disabled for this channel.',
      });
    });
  });

  describe('GET /api/media-source/[videoId]', () => {
    it('matches the documented response shape for success', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(prisma.video.findUnique).mockResolvedValue({ id: 'v1', videoUrl: 'https://media.example.com/v.mp4' } as any);
      vi.mocked(AccessPolicy.canViewVideo).mockResolvedValue({ allowed: true } as any);

      const req = new NextRequest('http://localhost/api/media-source/v1');
      const res = await mediaSourceGET(req, { params: { videoId: 'v1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        hasAccess: true,
        kind: 'direct',
        label: 'Plik wideo',
        playbackUrl: '/api/media/v1',
        needsProxy: true
      });
    });

    it('matches the documented response shape for forbidden', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(prisma.video.findUnique).mockResolvedValue({ id: 'v1' } as any);
      vi.mocked(AccessPolicy.canViewVideo).mockResolvedValue({ allowed: false, reason: 'PATRON_ONLY', requiredTier: 'PATRON' } as any);

      const req = new NextRequest('http://localhost/api/media-source/v1');
      const res = await mediaSourceGET(req, { params: { videoId: 'v1' } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data).toEqual({
        hasAccess: false,
        reason: 'PATRON_ONLY',
        requiredTier: 'PATRON'
      });
    });
  });

  describe('POST /api/checkout/create-intent', () => {
    it('matches the documented response shape', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
      vi.mocked(UserService.getOrCreateUser).mockResolvedValue({ id: 'user_1' } as any);
      vi.mocked(PaymentService.createPayment).mockResolvedValue({ id: 'pay_1', clientSecret: 'secret_1' } as any);

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
