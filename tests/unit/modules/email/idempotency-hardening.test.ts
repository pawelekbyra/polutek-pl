import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';

vi.mock('@/lib/modules/email/infrastructure/email-event-lock.service');

describe('handleResendWebhook - Idempotency Hardening', () => {
  const prismaMock = {
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
    emailEvent: {
        update: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prismaMock)),
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'system', reason: 'test' },
  });

  (ctx.db as any).writeTransaction = prismaMock.$transaction;

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', broadcastEmailId: 'b1', status: 'PENDING' });
    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.broadcastEmail.update.mockResolvedValue({});
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
  });

  it('stops processing if event is already processed', async () => {
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ALREADY_PROCESSED');

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      eventId: 'evt_123',
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
    // Should NOT reach business logic
    expect(prismaMock.broadcastEmailRecipient.findFirst).not.toHaveBeenCalled();
    expect(EmailEventLockService.prototype.releaseWithSuccess).not.toHaveBeenCalled();
  });

  it('fails processing if there is a lock conflict (concurrently processing) to trigger provider retry', async () => {
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('CONFLICT');

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      eventId: 'evt_123',
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
        expect(result.error.statusCode).toBe(503);
        expect(result.error.message).toContain('Event lock conflict');
    }
    expect(prismaMock.broadcastEmailRecipient.findFirst).not.toHaveBeenCalled();
  });

  it('completes processing and releases lock on success', async () => {
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', broadcastEmailId: 'b1', status: 'PENDING' });

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      eventId: 'evt_123',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    expect(EmailEventLockService.prototype.releaseWithSuccess).toHaveBeenCalledWith('evt_123', expect.anything());
    expect(prismaMock.broadcastEmailRecipient.updateMany).toHaveBeenCalled();
  });

  it('releases lock with failure if business logic throws', async () => {
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
    prismaMock.broadcastEmailRecipient.findFirst.mockRejectedValue(new Error('DB Error'));

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      eventId: 'evt_123',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(false);
    expect(EmailEventLockService.prototype.releaseWithFailure).toHaveBeenCalledWith('evt_123', 'DB Error');
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
      expect(EmailEventLockService.prototype.acquireLock).not.toHaveBeenCalled();
  });

  describe('handleInboundEmail error handling', () => {
    it('safely ignores P2002 duplicate inbound email', async () => {
        vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
        const p2002 = { code: 'P2002' };
        prismaMock.inboundEmail.create.mockRejectedValue(p2002);

        const result = await handleResendWebhook(ctx, {
            type: 'email.received',
            eventId: 'evt_recv_1',
            data: {
                email_id: 're_recv_1',
                from: 'sender@example.com',
                to: ['inbound@polutek.pl'],
                subject: 'Hello',
                created_at: new Date().toISOString(),
            },
        });

        expect(result.ok).toBe(true);
        expect(EmailEventLockService.prototype.releaseWithSuccess).toHaveBeenCalled();
    });

    it('propagates non-P2002 inbound email errors', async () => {
        vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
        prismaMock.inboundEmail.create.mockRejectedValue(new Error('Generic DB Error'));

        const result = await handleResendWebhook(ctx, {
            type: 'email.received',
            eventId: 'evt_recv_2',
            data: {
                email_id: 're_recv_2',
                from: 'sender@example.com',
                to: ['inbound@polutek.pl'],
                subject: 'Hello',
                created_at: new Date().toISOString(),
            },
        });

        expect(result.ok).toBe(false);
        expect(EmailEventLockService.prototype.releaseWithFailure).toHaveBeenCalledWith('evt_recv_2', expect.stringContaining('Generic DB Error'));
    });
  });
});
