import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/resend/route';
import { NextRequest } from 'next/server';
import { handleResendWebhook } from '@/lib/modules/email';
import { Webhook } from 'svix';

vi.mock('@/lib/modules/email', () => ({
  handleResendWebhook: vi.fn(),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(function() {
    return {
      verify: vi.fn().mockReturnValue({ type: 'email.sent', data: { email_id: 're_123' } }),
    };
  }),
}));

describe('Resend Webhook Route Contract', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, RESEND_WEBHOOK_SECRET: 'test-secret' };
  });

  it('rejects invalid signature', async () => {
    // Mock Webhook.verify to throw
    vi.mocked(Webhook).mockImplementationOnce(function() {
        return {
            verify: () => { throw new Error('Invalid signature'); }
        } as any;
    });

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'svix-id': '1',
        'svix-timestamp': '1',
        'svix-signature': '1',
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('calls handleResendWebhook for valid verified payload', async () => {
    vi.mocked(handleResendWebhook).mockResolvedValue({ ok: true, data: { received: true } } as any);

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'svix-id': 'evt_123',
        'svix-timestamp': '1',
        'svix-signature': 'sig_1',
      },
      body: JSON.stringify({ type: 'email.sent', data: { email_id: 're_123' } }),
    });

    await POST(req);
    expect(handleResendWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            eventId: 'evt_123'
        })
    );
  });

  it('handles malformed JSON payload predictably in non-production', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const req = new NextRequest('http://localhost/api/webhooks/resend', {
          method: 'POST',
          headers: {
              'x-resend-webhook-secret': 'test-secret',
          },
          body: 'not-json',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid JSON');
  });
});
