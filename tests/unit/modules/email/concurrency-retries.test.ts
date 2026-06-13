import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';
import { EmailError } from '@/lib/modules/email/domain/email.errors';

vi.mock('@/lib/modules/email/infrastructure/email-event-lock.service');

describe('handleResendWebhook - Advanced Concurrency and Race Retries', () => {
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

  (ctx.db as any).writeTransaction = prismaMock.$transaction;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
    vi.mocked(EmailEventLockService.prototype.releaseWithSuccess).mockResolvedValue();
  });

  it('retries when updateMany returns count 0 (CAS conflict)', async () => {
    // Attempt 1: find PENDING, but updateMany returns 0 (someone changed it)
    // Attempt 2: find SENT, but updateMany returns 1 (success)
    prismaMock.broadcastEmailRecipient.findFirst
      .mockResolvedValueOnce({ id: 'r1', broadcastEmailId: 'b1', status: 'PENDING' })
      .mockResolvedValueOnce({ id: 'r1', broadcastEmailId: 'b1', status: 'SENT' });

    prismaMock.broadcastEmailRecipient.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await handleResendWebhook(ctx, {
      type: 'email.delivered',
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
    expect(prismaMock.broadcastEmailRecipient.findFirst).toHaveBeenCalledTimes(2);
    expect(prismaMock.broadcastEmailRecipient.updateMany).toHaveBeenCalledTimes(2);
    // Aggregate counter should NOT be incremented because SENT -> DELIVERED transition
    // happens but aggregate logic only counts PENDING -> SENT or transition to error.
    expect(prismaMock.broadcastEmail.update).not.toHaveBeenCalled();
  });

  it('stops retrying if status priority becomes higher in concurrent update', async () => {
    // 1. We want to update to DELIVERED.
    // 2. We read PENDING.
    // 3. updateMany fails (someone else updated).
    // 4. We re-read and see BOUNCED (terminal).
    // 5. BOUNCED (100) > DELIVERED (3), so we should stop without further updateMany attempts.

    prismaMock.broadcastEmailRecipient.findFirst
      .mockResolvedValueOnce({ id: 'r1', broadcastEmailId: 'b1', status: 'PENDING' })
      .mockResolvedValueOnce({ id: 'r1', broadcastEmailId: 'b1', status: 'BOUNCED' });

    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 0 });

    const result = await handleResendWebhook(ctx, {
      type: 'email.delivered',
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
    expect(prismaMock.broadcastEmailRecipient.findFirst).toHaveBeenCalledTimes(2);
    expect(prismaMock.broadcastEmailRecipient.updateMany).toHaveBeenCalledTimes(1); // Only one attempt, second is aborted by priority check
  });

  it('throws CONCURRENCY_ERROR (503) after 3 failed attempts', async () => {
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', broadcastEmailId: 'b1', status: 'PENDING' });
    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 0 });

    const result = await handleResendWebhook(ctx, {
      type: 'email.sent',
      eventId: 'evt_race',
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
        expect(result.error.code).toBe('CONCURRENCY_ERROR');
        expect(result.error.statusCode).toBe(503);
    }
    expect(prismaMock.broadcastEmailRecipient.findFirst).toHaveBeenCalledTimes(3);
    expect(prismaMock.broadcastEmailRecipient.updateMany).toHaveBeenCalledTimes(3);
  });
});
