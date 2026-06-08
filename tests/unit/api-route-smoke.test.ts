import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { GET as getMedia, HEAD as headMedia } from '@/app/api/media/[...path]/route';
import { POST as createCheckoutIntent } from '@/app/api/checkout/create-intent/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
    },
    creator: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/blob', () => ({
  getGatedBlobResponse: vi.fn(),
}));

vi.mock('@/lib/feature-flags', () => ({
  flags: {
    demoFallbacks: false,
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/services/payments/checkout.service', () => ({
  PaymentCheckoutService: {
    createPayment: vi.fn(),
  },
}));

vi.mock('@/lib/services/user/profile.service', () => ({
  UserProfileService: {
    getOrCreateUser: vi.fn(),
  },
}));

describe('API route smoke checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 239 });
  });

  it('/api/media returns a non-500 response when Redis-backed rate limiting allows the request', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(prisma.video.findUnique).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/media/missing-video');
    const res = await getMedia(req, { params: { path: ['missing-video'] } });

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(500);
  });

  it('/api/media supports HEAD requests', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(prisma.video.findUnique).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/media/missing-video', { method: 'HEAD' });
    const res = await headMedia(req, { params: { path: ['missing-video'] } });

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(500);
  });

  it('/api/checkout/create-intent returns a non-500 response for unauthenticated requests before Stripe work starts', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const req = new NextRequest('http://localhost/api/checkout/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amountMinor: 1000, currency: 'PLN', title: 'Smoke test' }),
    });
    const res = await createCheckoutIntent(req);

    expect(res.status).toBe(401);
    expect(res.status).not.toBe(500);
  });
});
