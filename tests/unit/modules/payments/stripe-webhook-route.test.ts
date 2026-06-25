import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/stripe/route';
import { handleStripeWebhook } from '@/lib/modules/payments';
import { ok, fail } from '@/lib/modules/shared/result';
import { PaymentError } from '@/lib/modules/payments/domain/payment.errors';

vi.mock('@/lib/modules/payments', () => ({
  handleStripeWebhook: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createScopedLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

function stripeRequest(headers: Record<string, string> = { 'stripe-signature': 'test-sig' }) {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: 'evt_123' }),
  });
}

describe('Stripe Webhook Route Actor Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes AppContext with system actor and stripe-webhook reason', async () => {
    vi.mocked(handleStripeWebhook).mockResolvedValue(ok({ received: true }) as any);

    await POST(stripeRequest());

    expect(handleStripeWebhook).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor: { type: 'system', reason: 'stripe-webhook' },
      })
    );
  });

  it('returns 400 and does not call handler when stripe signature header is missing', async () => {
    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing stripe-signature' });
    expect(handleStripeWebhook).not.toHaveBeenCalled();
  });

  it('returns handler success payload with 200', async () => {
    vi.mocked(handleStripeWebhook).mockResolvedValue(ok({ received: true }) as any);

    const response = await POST(stripeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  it('maps handler processing failure to a retryable server error', async () => {
    vi.mocked(handleStripeWebhook).mockResolvedValue(
      fail(new PaymentError('Database write failed')) as any
    );

    const response = await POST(stripeRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'PAYMENT_WEBHOOK_PROCESSING_ERROR',
      message: 'Database write failed',
    });
  });

  it('keeps signature failure as a client error', async () => {
    vi.mocked(handleStripeWebhook).mockResolvedValue(
      fail(new PaymentError('Webhook Signature Error: invalid signature')) as any
    );

    const response = await POST(stripeRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'PAYMENT_ERROR',
      message: 'Webhook Signature Error: invalid signature',
    });
  });
});
