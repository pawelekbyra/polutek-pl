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
      updateMany: vi.fn(),
    },
    broadcastEmail: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    emailPreference: {
      upsert: vi.fn(),
    },
    inboundEmail: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prismaMock)),
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'system', reason: 'test' },
  });

  // Ensure ctx.db.writeTransaction uses our mock
  (ctx.db as any).writeTransaction = prismaMock.$transaction;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
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

  it('rejects events without eventId (svix-id)', async () => {
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

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('EMAIL_WEBHOOK_INVALID_PAYLOAD');
        expect(result.error.message).toContain('eventId (svix-id) is required');
    }
  });

  it('accepts unsupported event type as ignored, not failure', async () => {
    const result = await handleResendWebhook(ctx, {
      type: 'email.unknown_type',
      eventId: 'evt_unknown',
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
      const result = await handleResendWebhook(ctx, {
          type: 'email.sent',
          eventId: 'evt_no_email_id',
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
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      broadcastEmailId: 'b1',
      status: 'CLICKED'
    });

    const result = await handleResendWebhook(ctx, {
      type: 'email.opened',
      eventId: 'evt_opened_late',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    // updateMany should NOT be called because CLICKED (priority 5) > OPENED (priority 4)
    expect(prismaMock.broadcastEmailRecipient.updateMany).not.toHaveBeenCalled();
  });

  it('terminal status protection: DELIVERED does not overwrite BOUNCED', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      broadcastEmailId: 'b1',
      status: 'BOUNCED'
    });

    const result = await handleResendWebhook(ctx, {
      type: 'email.delivered',
      eventId: 'evt_delivered_late',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    // updateMany should NOT be called because BOUNCED (priority 100) > DELIVERED (priority 3)
    expect(prismaMock.broadcastEmailRecipient.updateMany).not.toHaveBeenCalled();
  });

  it('implements status hierarchy: SENT does not overwrite DELIVERED', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      broadcastEmailId: 'b1',
      status: 'DELIVERED'
    });

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      eventId: 'evt_sent_late',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.broadcastEmailRecipient.updateMany).not.toHaveBeenCalled();
  });

  it('updates aggregate counts correctly on first SENT event', async () => {
      prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
          id: 'r1',
          broadcastEmailId: 'b1',
          status: 'PENDING'
      });
      prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 1 });

      const result = await handleResendWebhook(ctx, {
          type: 'email.sent',
          eventId: 'evt_sent_1',
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
      prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
          id: 'r1',
          broadcastEmailId: 'b1',
          status: 'SENT'
      });
      prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 1 });

      const result = await handleResendWebhook(ctx, {
          type: 'email.delivered',
          eventId: 'evt_delivered_1',
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
      expect(prismaMock.broadcastEmailRecipient.updateMany).toHaveBeenCalled();
      expect(prismaMock.broadcastEmail.update).not.toHaveBeenCalled();
  });
});
