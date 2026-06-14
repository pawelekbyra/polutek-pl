import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { Prisma, WebhookEventStatus } from '@prisma/client';

describe('handleResendWebhook - Idempotency Race Proof', () => {
  const prismaMock = {
    emailEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
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
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    db: {
        read: prismaMock as any,
        writeTransaction: vi.fn((cb) => cb(prismaMock)),
    } as any,
    actor: { type: 'system', reason: 'test' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('proves that concurrent calls are handled correctly via DB unique constraint', async () => {
    let callCount = 0;
    prismaMock.emailEvent.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.emailEvent.create.mockImplementation(() => {
        callCount++;
        if (callCount > 1) {
            // Simulate P2002 Unique Constraint Violation
            const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: 'test',
                meta: { target: ['providerEventId'] }
            });
            return Promise.reject(error);
        }
        return Promise.resolve({ id: 'new-event-uuid' });
    });

    // When the second call hits the conflict, it will check the status of the existing event.
    // Let's simulate that the first call is still PROCESSING or already PROCESSED.
    prismaMock.emailEvent.findUnique.mockResolvedValue({
        providerEventId: 'svix_123',
        status: WebhookEventStatus.PROCESSED,
        type: 'email.sent'
    });

    prismaMock.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.broadcastEmailRecipient.findFirst.mockResolvedValue({
        id: 'r1',
        broadcastEmailId: 'b1',
        status: 'PENDING'
    });

    const payload = {
      type: 'email.sent',
      eventId: 'svix_123',
      data: {
        email_id: 're_123',
        from: 'no-reply@polutek.pl',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: new Date().toISOString(),
      },
    };

    // Simulate concurrent calls
    const results = await Promise.all([
      handleResendWebhook(ctx, payload),
      handleResendWebhook(ctx, payload)
    ]);

    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(true);

    // emailEvent.create should have been attempted twice, but only one succeeded in DB logic
    expect(prismaMock.emailEvent.create).toHaveBeenCalledTimes(2);

    // Business logic (find recipient) should be called exactly ONCE
    expect(prismaMock.broadcastEmailRecipient.findFirst).toHaveBeenCalledTimes(1);

    // Counter increment should be called exactly ONCE
    expect(prismaMock.broadcastEmail.update).toHaveBeenCalledTimes(1);
    // Success release should be called exactly ONCE on the write handle
    expect(prismaMock.emailEvent.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.broadcastEmail.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { sentCount: { increment: 1 } }
    }));
  });
});
