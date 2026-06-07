import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/webhooks/resend/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailEvent: {
      create: vi.fn(),
    },
    broadcastEmailRecipient: {
        findFirst: vi.fn(),
    }
  },
}));

describe('Resend Webhook Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('blocks request if secret is missing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RESEND_WEBHOOK_SECRET = '';

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: { 'x-resend-webhook-secret': 'some-secret' },
      body: JSON.stringify({ type: 'test' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Webhook not configured');
  });

  it('returns 401 if secret is invalid', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'correct-secret';

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: { 'x-resend-webhook-secret': 'wrong-secret' },
      body: JSON.stringify({ type: 'test' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('allows request if secret is correct', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'correct-secret';
    (prisma.emailEvent.create as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: { 'x-resend-webhook-secret': 'correct-secret' },
      body: JSON.stringify({ type: 'email.sent', data: { email_id: '123' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
