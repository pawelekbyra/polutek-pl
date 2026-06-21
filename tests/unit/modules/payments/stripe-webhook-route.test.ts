import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/stripe/route';
import { handleStripeWebhook } from '@/lib/modules/payments';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/modules/payments', () => ({
  handleStripeWebhook: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createScopedLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('Stripe Webhook Route Actor Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes AppContext with system actor and stripe-webhook reason', async () => {
    vi.mocked(handleStripeWebhook).mockResolvedValue(ok({ received: true }) as any);

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 'test-sig',
      },
      body: JSON.stringify({ id: 'evt_123' }),
    });

    await POST(req);

    expect(handleStripeWebhook).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor: { type: 'system', reason: 'stripe-webhook' },
      })
    );
  });
});
