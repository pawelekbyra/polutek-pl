import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccountDeletionCleanupUseCase } from '@/lib/modules/users/application/account-deletion-cleanup.use-case';
import { sendAccountDeletedEmail } from '@/lib/modules/email';

vi.mock('@/lib/modules/email/application/send-transactional-email.use-case', () => ({
  sendAccountDeletedEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('AccountDeletionCleanupUseCase', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'user@example.com', isDeleted: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      patronGrant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      subscription: {
        findMany: vi.fn().mockResolvedValue([{ creatorId: 'creator-1' }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(4),
      },
      creator: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      emailPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn((fn) => fn(prisma)),
    };
  });

  function ctx() {
    return createAppContext({ actor: { type: 'system', reason: 'test' }, prisma, now: () => new Date('2026-06-26T00:00:00.000Z') });
  }

  it('anonymizes user, revokes access, removes consent, resyncs subscriber count, and audits', async () => {
    await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'CLERK_WEBHOOK', reason: 'deleted' });

    expect(prisma.patronGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: new Date('2026-06-26T00:00:00.000Z'), reason: 'deleted' },
    });
    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.emailPreference.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'u1' }, { email: 'user@example.com' }] },
    });
    expect(prisma.creator.updateMany).toHaveBeenCalledWith({ where: { id: 'creator-1' }, data: { subscribersCount: 4 } });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ isDeleted: true, patronSince: null, patronSource: null, stripeCustomerId: null, imageUrl: null }),
    }));
    expect(prisma.user.update.mock.calls[0][0].data.email).toMatch(/^deleted_.*@deleted\.com$/);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('treats missing local user as successful idempotent cleanup', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'missing', source: 'CLERK_WEBHOOK' });

    expect(result).toEqual({ cleaned: false, alreadyDeleted: true, originalEmail: null });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('is idempotent for an already anonymized deleted user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'deleted_abc@deleted.com', isDeleted: true });

    await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'CLERK_WEBHOOK' });

    expect(prisma.user.update.mock.calls[0][0].data.email).toBe('deleted_abc@deleted.com');
    expect(sendAccountDeletedEmail).not.toHaveBeenCalled();
  });
});
