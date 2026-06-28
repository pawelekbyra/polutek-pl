import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users/application/sync-user-from-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { toPublicCommentAuthor } from '@/lib/comments-public-author';

vi.mock('@/lib/modules/email/application/send-transactional-email.use-case', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendAccountDeletedEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('Account Deletion Integrity', () => {
  let mockPrisma: any;
  const ctx = (actor: any = { type: 'system', reason: 'test' }) => createAppContext({ actor, prisma: mockPrisma });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
        user: {
            update: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn()
        },
        patronGrant: { updateMany: vi.fn() },
        comment: { delete: vi.fn(), deleteMany: vi.fn() },
        commentReaction: { delete: vi.fn(), deleteMany: vi.fn() },
        commentLike: { delete: vi.fn(), deleteMany: vi.fn() },
        commentDislike: { delete: vi.fn(), deleteMany: vi.fn() },
        subscription: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        emailPreference: { deleteMany: vi.fn() },
        creator: { updateMany: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn() },
        $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
  });

  it('preserves discussion integrity by soft-deleting rather than hard-deleting', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'john@example.com', isDeleted: false });

    await SyncUserFromWebhookUseCase.softDelete(ctx(), 'u1');

    // 1. User is updated (soft-deleted), not deleted
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
            isDeleted: true,
            name: "Usunięty Użytkownik"
        })
    }));
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    expect(mockPrisma.user.deleteMany).not.toHaveBeenCalled();

    // 2. Discussion items (comments, reactions) are NOT deleted
    expect(mockPrisma.comment.delete).not.toHaveBeenCalled();
    expect(mockPrisma.comment.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.commentReaction.delete).not.toHaveBeenCalled();
    expect(mockPrisma.commentReaction.deleteMany).not.toHaveBeenCalled();
  });

  it('cleans up private data like subscriptions and email preferences during soft-delete', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'john@example.com', isDeleted: false });
    mockPrisma.subscription.count.mockResolvedValue(1);
    mockPrisma.subscription.findMany.mockResolvedValue([{ creatorId: 'c1' }]);

    await SyncUserFromWebhookUseCase.softDelete(ctx(), 'u1');

    // Subscriptions are deleted
    expect(mockPrisma.subscription.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'u1' }
    }));

    // Creator subscriber count is decremented
    expect(mockPrisma.creator.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'c1' },
        data: { subscribersCount: 1 }
    }));

    // Email preferences are deleted
    expect(mockPrisma.emailPreference.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { OR: [{ userId: 'u1' }, { email: 'john@example.com' }] }
    }));
  });

  it('renders soft-deleted author neutrally to preserve public discussion', () => {
    // Simulated database state for a soft-deleted user
    const softDeletedUser = {
      id: 'u1',
      name: "Usunięty Użytkownik",
      username: "deleted_abc123",
      imageUrl: "https://example.com/image.png",
      patronGrants: [{ id: 'grant-1' }],
      isDeleted: true,
      role: 'USER' as const,
    };

    const authorDto = toPublicCommentAuthor(softDeletedUser);

    expect(authorDto).toEqual({
        id: 'u1',
        displayName: "Usunięty Użytkownik",
        username: null,
        imageUrl: null,
        badges: []
    });
  });
});
