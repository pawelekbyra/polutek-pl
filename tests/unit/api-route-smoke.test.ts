import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';
import { rateLimit } from '@/lib/rate-limit';
import { POST as createCheckoutIntent } from '@/app/api/checkout/create-intent/route';

vi.mock('@/lib/auth/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/feature-flags', () => ({
  flags: {
    demoFallbacks: false,
  },
  canUseDemoFallbacks: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));


vi.mock('@/lib/modules/users', () => ({
  getOrCreateCurrentUser: vi.fn(),
}));

describe('API route smoke checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 239 });
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
