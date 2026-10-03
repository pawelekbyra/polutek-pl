import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setCommentReaction } from '@/lib/modules/comments/application/set-comment-reaction.use-case';
import { setVideoReaction } from '@/lib/modules/comments/application/set-video-reaction.use-case';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { checkVideoAccess } from '@/lib/modules/access';
import { sendNotification } from '@/lib/modules/notifications';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { ok } from '@/lib/modules/shared/result';
import { CommentStatus } from '@prisma/client';

vi.mock('@/lib/modules/comments/infrastructure/comment.repository', () => ({ CommentRepository: vi.fn() }));
vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));
vi.mock('@/lib/modules/notifications', () => ({
  sendNotification: vi.fn(),
  notificationTemplates: { commentLike: { kind: 'COMMENT', titlePl: '', titleEn: '', bodyPl: '', bodyEn: '' } },
}));

describe('reaction use cases (target state)', () => {
  let repo: any;
  const prisma = { $transaction: (fn: any) => fn({}), video: { findUnique: vi.fn().mockResolvedValue({ slug: 'film' }) } };
  const user = () => createAppContext({ actor: { type: 'user', userId: 'u1' }, prisma: prisma as any });

  beforeEach(() => {
    vi.clearAllMocks();
    repo = {
      findCommentById: vi.fn().mockResolvedValue({ id: 'c1', videoId: 'v1', authorId: 'author-1', status: CommentStatus.VISIBLE, author: { isDeleted: false } }),
      setCommentReaction: vi.fn().mockResolvedValue({ likeDelta: 1 }),
      getCommentReactionSnapshot: vi.fn().mockResolvedValue({ viewerReaction: 'LIKE', likesCount: 4 }),
      setVideoReaction: vi.fn(),
      getVideoReactionSnapshot: vi.fn().mockResolvedValue({ liked: true, disliked: false, likesCount: 9, dislikesCount: 0 }),
    };
    vi.mocked(CommentRepository).mockImplementation(function () { return repo; } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: true } as any));
  });

  it('denies guests', async () => {
    const result = await setCommentReaction({ commentId: 'c1', reaction: 'LIKE' }, createAppContext({ actor: { type: 'guest' }, prisma: prisma as any }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('UNAUTHORIZED');
  });

  it('returns the stored state and notifies the author only for a like that was actually added', async () => {
    const result = await setCommentReaction({ commentId: 'c1', reaction: 'LIKE' }, user());
    expect(result).toEqual({ ok: true, data: { viewerReaction: 'LIKE', likesCount: 4 } });
    expect(repo.setCommentReaction).toHaveBeenCalledWith('u1', 'c1', 'LIKE');
    expect(sendNotification).toHaveBeenCalledTimes(1);

    repo.setCommentReaction.mockResolvedValue({ likeDelta: 0 }); // second click: nothing changed
    await setCommentReaction({ commentId: 'c1', reaction: 'LIKE' }, user());
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it('does not accept reactions to a comment the viewer cannot see', async () => {
    repo.findCommentById.mockResolvedValue({ id: 'c1', videoId: 'v1', authorId: 'a', status: CommentStatus.HIDDEN, author: { isDeleted: false } });
    const result = await setCommentReaction({ commentId: 'c1', reaction: 'LIKE' }, user());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
  });

  it('a unique-constraint or any database error never reaches the client verbatim', async () => {
    repo.setCommentReaction.mockRejectedValue(new Error('Unique constraint failed on the fields: (`userId`,`commentId`)'));
    const result = await setCommentReaction({ commentId: 'c1', reaction: 'LIKE' }, user());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('DATABASE_ERROR');
      expect(result.error.message).not.toContain('constraint');
    }
  });

  it('setVideoReaction passes the target state and returns the counters', async () => {
    const result = await setVideoReaction({ videoId: 'v1', reaction: null }, user());
    expect(repo.setVideoReaction).toHaveBeenCalledWith('u1', 'v1', null);
    expect(result).toEqual({ ok: true, data: { liked: true, disliked: false, likesCount: 9, dislikesCount: 0 } });
  });

  it('setVideoReaction: no access is FORBIDDEN, a missing video NOT_FOUND', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValueOnce(ok({ hasAccess: false, reason: 'LOGIN_REQUIRED' } as any));
    const forbidden = await setVideoReaction({ videoId: 'v1', reaction: 'LIKE' }, user());
    expect(!forbidden.ok && forbidden.error.type).toBe('FORBIDDEN');

    vi.mocked(checkVideoAccess).mockResolvedValueOnce(ok({ hasAccess: false, reason: 'NOT_FOUND' } as any));
    const missing = await setVideoReaction({ videoId: 'v1', reaction: 'LIKE' }, user());
    expect(!missing.ok && missing.error.type).toBe('NOT_FOUND');
  });
});
