import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('handleResendWebhook use case - terminal states', () => {
  const prismaMock = {
    emailEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
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

  it('does not overwrite terminal BOUNCED status with OPENED', async () => {
    prismaMock.emailEvent.findFirst.mockResolvedValue(null);
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
        id: 'r1',
        broadcastEmailId: 'b1',
        status: 'BOUNCED'
    });

    const result = await handleResendWebhook(ctx, {
      type: 'email.opened',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    // Should update recipient BUT NOT status
    expect(prismaMock.broadcastEmailRecipient.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'r1' },
        data: expect.not.objectContaining({ status: 'OPENED' })
    }));
  });

  it('allows multiple OPENED events', async () => {
    // findFirst returns null because opened events are NOT deduped by best-effort policy
    prismaMock.emailEvent.findFirst.mockResolvedValue(null);
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
        id: 'r1',
        broadcastEmailId: 'b1',
        status: 'SENT'
    });

    const result = await handleResendWebhook(ctx, {
      type: 'email.opened',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.duplicate).toBe(false);
    }
    expect(prismaMock.emailEvent.create).toHaveBeenCalled();
  });
});
