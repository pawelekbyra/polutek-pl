import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('handleResendWebhook use case', () => {
  const prismaMock = {
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
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'system', reason: 'test' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs the event and accepts all requested event types', async () => {
    const types = [
        'email.sent', 'email.delivered', 'email.delivery_delayed',
        'email.bounced', 'email.complained', 'email.opened', 'email.clicked'
    ];

    for (const type of types) {
        prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', broadcastEmailId: 'b1' });

        const result = await handleResendWebhook(ctx, {
            type,
            data: {
                email_id: `re_${type}`,
                from: 'no-reply@polutek.pl',
                to: ['user@example.com'],
                subject: 'Hello',
                created_at: new Date().toISOString(),
            },
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.accepted).toBe(true);
        }
    }
  });

  it('accepts unsupported event type as ignored, not failure', async () => {
    const result = await handleResendWebhook(ctx, {
      type: 'email.unknown_type',
      data: {
        email_id: 're_456',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.accepted).toBe(true);
        expect(result.data.ignored).toBe(true);
    }
    expect(prismaMock.emailEvent.create).toHaveBeenCalled();
  });

  it('correctly updates status for bounced email', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', broadcastEmailId: 'b1' });

    const result = await handleResendWebhook(ctx, {
      type: 'email.bounced',
      data: {
        email_id: 're_bounce',
        from: 'no-reply@polutek.pl',
        to: ['bounced@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.broadcastEmailRecipient.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'BOUNCED' })
    }));
    // Should also update errorCount in BroadcastEmail
    expect(prismaMock.broadcastEmail.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ errorCount: expect.anything() })
    }));
  });
});
