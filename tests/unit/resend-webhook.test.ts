import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      update: vi.fn(),
    },
    broadcastEmail: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    emailPreference: {
      upsert: vi.fn(),
    },
    inboundEmail: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Resend Webhook API', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns 500 in production when RESEND_WEBHOOK_SECRET is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.RESEND_WEBHOOK_SECRET;

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'x-resend-webhook-secret': 'any-secret',
      },
      body: JSON.stringify({ type: 'test' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Webhook not configured');
  });

  it('returns 401 when secret is missing in request', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'valid-secret';

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({ type: 'test' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when secret is invalid', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'valid-secret';

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'x-resend-webhook-secret': 'wrong-secret',
      },
      body: JSON.stringify({ type: 'test' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 200 and processes event when secret is valid', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'valid-secret';

    const req = new NextRequest('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'x-resend-webhook-secret': 'valid-secret',
      },
      body: JSON.stringify({
        type: 'email.sent',
        data: {
          email_id: 're_123',
          to: ['user@example.com'],
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.emailEvent.create).toHaveBeenCalled();
  });
});
