import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';

vi.mock('@/lib/modules/email/infrastructure/email-event-lock.service');

describe('handleResendWebhook use case - hardening', () => {
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

  it('rejects malformed payload (not an object)', async () => {
    const result = await handleResendWebhook(ctx, "not-an-object" as any);
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('EMAIL_WEBHOOK_INVALID_PAYLOAD');
    }
  });

  it('rejects payload with missing data', async () => {
    const result = await handleResendWebhook(ctx, { type: 'email.sent' } as any);
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('EMAIL_WEBHOOK_INVALID_PAYLOAD');
    }
  });

  it('accepts unsupported event type as ignored, not failure', async () => {
    prismaMock.emailEvent.findFirst.mockResolvedValue(null);

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
  });

  it('safely handles missing email_id in known event', async () => {
      prismaMock.emailEvent.findFirst.mockResolvedValue(null);

      const result = await handleResendWebhook(ctx, {
          type: 'email.sent',
          data: {
              from: 'no-reply@polutek.pl',
              to: ['user@example.com'],
              subject: 'Hello',
              created_at: new Date().toISOString(),
          } as any,
      });

      expect(result.ok).toBe(true);
      // Status update should NOT be called if no email_id
      expect(prismaMock.broadcastEmailRecipient.findFirst).not.toHaveBeenCalled();
  });

  it('explicitly returns idempotency: best_effort', async () => {
    prismaMock.emailEvent.findFirst.mockResolvedValue(null);
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
    if (result.ok) {
        expect(result.data.idempotency).toBe('best_effort');
    }
  });

  it('detects and ignores duplicate events', async () => {
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ALREADY_PROCESSED');

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      eventId: 'duplicate_id',
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
        expect(result.data.duplicate).toBe(true);
    }
    // Should NOT reach prisma create or updates
    expect(prismaMock.broadcastEmailRecipient.findFirst).not.toHaveBeenCalled();
  });

  it('implements status hierarchy: OPENED does not overwrite CLICKED', async () => {
    prismaMock.emailEvent.findFirst.mockResolvedValue(null);
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      broadcastEmailId: 'b1',
      status: 'CLICKED'
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
    // update should NOT be called because CLICKED (priority 5) > OPENED (priority 4)
    expect(prismaMock.broadcastEmailRecipient.update).not.toHaveBeenCalled();
  });

  it('terminal status protection: DELIVERED does not overwrite BOUNCED', async () => {
    prismaMock.emailEvent.findFirst.mockResolvedValue(null);
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      broadcastEmailId: 'b1',
      status: 'BOUNCED'
    });

    const result = await handleResendWebhook(ctx, {
      type: 'email.delivered',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    // update should NOT be called because BOUNCED (priority 100) > DELIVERED (priority 3)
    expect(prismaMock.broadcastEmailRecipient.update).not.toHaveBeenCalled();
  });

  it('updates aggregate counts correctly on first SENT event', async () => {
      prismaMock.emailEvent.findFirst.mockResolvedValue(null);
      prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
          id: 'r1',
          broadcastEmailId: 'b1',
          status: 'PENDING'
      });

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
      expect(prismaMock.broadcastEmail.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'b1' },
          data: { sentCount: { increment: 1 } }
      }));
  });

  it('does NOT update aggregate counts if already SENT', async () => {
      prismaMock.emailEvent.findFirst.mockResolvedValue(null);
      prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
          id: 'r1',
          broadcastEmailId: 'b1',
          status: 'SENT'
      });

      const result = await handleResendWebhook(ctx, {
          type: 'email.delivered',
          data: {
              email_id: 're_123',
              from: 'no-reply@polutek.pl',
              to: ['user@example.com'],
              subject: 'Hello',
              created_at: new Date().toISOString(),
          },
      });

      expect(result.ok).toBe(true);
      // It should update recipient to DELIVERED, but NOT increment BroadcastEmail.sentCount again
      expect(prismaMock.broadcastEmailRecipient.update).toHaveBeenCalled();
      expect(prismaMock.broadcastEmail.update).not.toHaveBeenCalled();
  });
});
