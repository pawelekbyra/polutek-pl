import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';

vi.mock('@/lib/modules/email/infrastructure/email-event-lock.service');

describe('handleResendWebhook - Concurrency and Error Preservation', () => {
  const prismaMock = {
    broadcastEmailRecipient: {
      findFirst: vi.fn(),
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

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
  });

  it('handles concurrent updates by checking affected rows count', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
        id: 'r1',
        broadcastEmailId: 'b1',
        status: 'PENDING'
    });
    // Simulate another transaction won the race and updated the status
    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 0 });

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
    // Should NOT increment counter if updateMany affected 0 rows
    expect(prismaMock.broadcastEmail.update).not.toHaveBeenCalled();
  });

  it('increments counter only if updateMany affected 1 row', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
        id: 'r1',
        broadcastEmailId: 'b1',
        status: 'PENDING'
    });
    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 1 });

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
    expect(prismaMock.broadcastEmail.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { sentCount: { increment: 1 } }
    }));
  });

  it('preserves original error when releaseWithFailure fails', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockRejectedValue(new Error('Primary Logic Error'));
    vi.mocked(EmailEventLockService.prototype.releaseWithFailure).mockRejectedValue(new Error('Secondary Lock Error'));

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
        expect(result.error.message).toBe('Primary Logic Error');
    }
    expect(EmailEventLockService.prototype.releaseWithFailure).toHaveBeenCalled();
  });

  it('returns failure when releaseWithSuccess fails on a supported processed event', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
        id: 'r1',
        broadcastEmailId: 'b1',
        status: 'PENDING'
    });
    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(EmailEventLockService.prototype.releaseWithSuccess).mockRejectedValue(new Error('Lock Release Failure'));

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
        expect(result.error.message).toContain('Failed to finalize event processing');
    }
  });

  it('ignores releaseWithSuccess failure for UNSUPPORTED ignored events', async () => {
    vi.mocked(EmailEventLockService.prototype.releaseWithSuccess).mockRejectedValue(new Error('Lock Release Failure'));

    const result = await handleResendWebhook(ctx, {
      type: 'unsupported.type',
      eventId: 'evt_unsupported',
      data: {
        email_id: 're_unsupported',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.ignored).toBe(true);
    }
  });
});
