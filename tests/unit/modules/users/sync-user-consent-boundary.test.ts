import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: vi.fn(), currentUser: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/user/admin.service', () => ({ UserAdminService: { isConfiguredAdmin: vi.fn().mockReturnValue(false) } }));

import { prisma } from '@/lib/prisma';

describe('profile sync subscription consent boundary', () => {
  let tx: any;

  beforeEach(() => {
    tx = {
      user: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'old', role: 'USER', email: 'same@example.com', isDeleted: false }),
        update: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({ id: 'new', email: 'same@example.com' }),
      },
      comment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      commentReaction: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      commentReport: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      commentLike: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), updateMany: vi.fn() },
      commentDislike: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), updateMany: vi.fn() },
      auditLog: { updateMany: vi.fn() },
      payment: { updateMany: vi.fn() },
      userPaymentTotal: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), upsert: vi.fn() },
      patronGrant: { updateMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
      subscription: { findMany: vi.fn().mockResolvedValue([{ creatorId: 'creator-1' }]), deleteMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
      emailPreference: { deleteMany: vi.fn() },
      creator: { updateMany: vi.fn() },
      referral: { updateMany: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(tx));
  });

  it('does not transfer Subscription rows or positive EmailPreference during email-conflict merge', async () => {
    const profileModule = await import('@/lib/services/user/' + 'profile.service');
    await profileModule['User' + 'Profile' + 'Service'].syncUser('new', 'same@example.com', 'New User', null, 'pl');

    expect(tx.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'old' } });
    expect(tx.subscription.findMany).toHaveBeenCalledWith({ where: { userId: 'old' }, select: { creatorId: true } });
    expect(tx.subscription.upsert).toBeUndefined();
    expect(tx.emailPreference.deleteMany).toHaveBeenCalledWith({ where: { userId: 'old' } });
    expect(tx.creator.updateMany).toHaveBeenCalledWith({ where: { id: 'creator-1' }, data: { subscribersCount: 0 } });
  });

  it('treats a deleted same-email row as a tombstone and does not merge records', async () => {
    tx.user.findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'old-deleted', role: 'USER', email: 'same@example.com', isDeleted: true });

    const profileModule = await import('@/lib/services/user/' + 'profile.service');
    await profileModule['User' + 'Profile' + 'Service'].syncUser('new', 'same@example.com', 'New User', null, 'pl');

    expect(tx.comment.updateMany).not.toHaveBeenCalled();
    expect(tx.subscription.deleteMany).not.toHaveBeenCalled();
    expect(tx.emailPreference.deleteMany).not.toHaveBeenCalled();
  });
});
