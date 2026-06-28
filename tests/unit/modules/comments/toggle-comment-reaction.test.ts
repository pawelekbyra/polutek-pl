import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toggleCommentLike } from '@/lib/modules/comments/application/toggle-comment-like.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

describe('Comment Reaction Use Case', () => {
  let mockPrisma: any;
  const commentId = 'c1';
  const videoId = 'v1';
  const userId = 'u1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      comment: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      commentReaction: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
  });

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma });

  it('denies guest', async () => {
    const result = await toggleCommentLike({ commentId, action: 'LIKE' }, createCtx({ type: 'guest' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('UNAUTHORIZED');
  });

  it('likes comment successfully', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: commentId, videoId, authorId: 'other' });
    (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
    mockPrisma.commentReaction.findUnique.mockResolvedValue(null);

    const result = await toggleCommentLike({ commentId, action: 'LIKE' }, createCtx({ type: 'user', userId }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.liked).toBe(true);
    expect(mockPrisma.commentReaction.create).toHaveBeenCalled();
  });

  it('unlikes comment successfully', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: commentId, videoId, authorId: 'other' });
    (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
    mockPrisma.commentReaction.findUnique.mockResolvedValue({ id: 'r1' });

    const result = await toggleCommentLike({ commentId, action: 'UNLIKE' }, createCtx({ type: 'user', userId }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.liked).toBe(false);
    expect(mockPrisma.commentReaction.delete).toHaveBeenCalled();
  });
});
