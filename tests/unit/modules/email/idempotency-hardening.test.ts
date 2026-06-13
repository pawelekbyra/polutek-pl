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
    }
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'system', reason: 'test' },
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', broadcastEmailId: 'b1', status: 'PENDING' });
    prismaMock.broadcastEmailRecipient.update.mockResolvedValue({});
    prismaMock.broadcastEmail.update.mockResolvedValue({});
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

  it('stops processing if there is a lock conflict (concurrently processing)', async () => {
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

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.duplicate).toBe(true);
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
    expect(prismaMock.broadcastEmailRecipient.update).toHaveBeenCalled();
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

  it('correctly handles events without eventId (best effort)', async () => {
      // Mocking acquireLock should not be called if eventId is missing
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
      expect(EmailEventLockService.prototype.acquireLock).not.toHaveBeenCalled();
      if (result.ok) {
          expect(result.data.idempotency).toBe('best_effort');
      }
  });
});
