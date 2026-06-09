import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUserUseCase } from '@/lib/modules/users/application/sync-user.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((cb) => cb(prisma)),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    comment: { updateMany: vi.fn() },
    commentReaction: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    commentReport: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    commentLike: { deleteMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    commentDislike: { deleteMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    auditLog: { updateMany: vi.fn(), create: vi.fn() },
    payment: { updateMany: vi.fn() },
    userPaymentTotal: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    patronGrant: { updateMany: vi.fn() },
    subscription: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    referral: { updateMany: vi.fn() },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SyncUserUseCase', () => {
  const ctx = createAppContext({ actor: { type: 'system', reason: 'test' } as any, prisma: prisma as any });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new user when no conflict exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'u1', email: 'u1@example.com', role: 'USER' } as any);

    const result = await SyncUserUseCase.execute(ctx, {
      id: 'u1',
      email: 'u1@example.com',
      name: 'User One'
    });

    expect(result.id).toBe('u1');
    expect(prisma.user.upsert).toHaveBeenCalled();
  });

  it('should handle email conflict and repoint records', async () => {
    const existingById = null;
    const existingByEmail = { id: 'old-u', email: 'u1@example.com', role: 'USER' } as any;

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(existingById)
      .mockResolvedValueOnce(existingByEmail);

    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'new-u', email: 'u1@example.com', role: 'USER' } as any);
    vi.mocked(prisma.commentReaction.findMany).mockResolvedValue([]);
    vi.mocked(prisma.commentReport.findMany).mockResolvedValue([]);
    vi.mocked(prisma.commentLike.findMany).mockResolvedValue([]);
    vi.mocked(prisma.commentDislike.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userPaymentTotal.findMany).mockResolvedValue([]);
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

    await SyncUserUseCase.execute(ctx, {
      id: 'new-u',
      email: 'u1@example.com',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-u' },
    }));
    expect(prisma.comment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { authorId: 'old-u' },
      data: { authorId: 'new-u' }
    }));
    expect(logger.warn).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
