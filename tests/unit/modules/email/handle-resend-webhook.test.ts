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

  it('logs the event and accepts known event type', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', broadcastEmailId: 'b1' });

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.emailEvent.create).toHaveBeenCalled();
    expect(prismaMock.broadcastEmailRecipient.update).toHaveBeenCalled();
  });

  it('accepts unsupported event type as ignored', async () => {
    const result = await handleResendWebhook(ctx, {
      type: 'email.some_new_type',
      data: {
        email_id: 're_456',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.emailEvent.create).toHaveBeenCalled();
    // No other updates should be called for unknown types
    expect(prismaMock.broadcastEmailRecipient.update).not.toHaveBeenCalled();
  });
});
