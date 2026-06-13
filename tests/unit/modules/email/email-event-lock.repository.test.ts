import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';
import { Prisma, WebhookEventStatus } from '@prisma/client';

describe('EmailEventLockService - Logic Proof', () => {
  const prismaMock = {
    emailEvent: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  };

  const lockService = new EmailEventLockService({ read: prismaMock as any, write: prismaMock as any });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('acquires lock on new event', async () => {
    prismaMock.emailEvent.create.mockResolvedValue({ id: 'evt_1' });

    const result = await lockService.acquireLock({ providerEventId: 'p_1', type: 't', payload: {} });

    expect(result).toBe('ACQUIRED');
    expect(prismaMock.emailEvent.create).toHaveBeenCalled();
  });

  it('returns CONFLICT if another process holds the lock (recent PROCESSING)', async () => {
    // 1. Initial create fails with P2002
    prismaMock.emailEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('msg', { code: 'P2002', clientVersion: 'v' }));

    // 2. Recovery updateMany finds no failed/stale events
    prismaMock.emailEvent.updateMany.mockResolvedValue({ count: 0 });

    // 3. findUnique shows it is currently PROCESSING
    prismaMock.emailEvent.findUnique.mockResolvedValue({ status: WebhookEventStatus.PROCESSING });

    const result = await lockService.acquireLock({ providerEventId: 'p_1', type: 't', payload: {} });

    expect(result).toBe('CONFLICT');
  });

  it('returns ALREADY_PROCESSED if event is done', async () => {
    prismaMock.emailEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('msg', { code: 'P2002', clientVersion: 'v' }));
    prismaMock.emailEvent.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.emailEvent.findUnique.mockResolvedValue({ status: WebhookEventStatus.PROCESSED });

    const result = await lockService.acquireLock({ providerEventId: 'p_1', type: 't', payload: {} });

    expect(result).toBe('ALREADY_PROCESSED');
  });

  it('re-acquires lock if existing event is FAILED', async () => {
    prismaMock.emailEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('msg', { code: 'P2002', clientVersion: 'v' }));

    // Recovery updateMany finds the failed event and resets it to PROCESSING
    prismaMock.emailEvent.updateMany.mockResolvedValue({ count: 1 });

    const result = await lockService.acquireLock({ providerEventId: 'p_1', type: 't', payload: {} });

    expect(result).toBe('ACQUIRED');
    expect(prismaMock.emailEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
            OR: expect.arrayContaining([
                expect.objectContaining({ status: WebhookEventStatus.FAILED })
            ])
        })
    }));
  });
});
