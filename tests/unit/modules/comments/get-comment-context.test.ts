import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCommentContext } from '@/lib/modules/comments/application/get-comment-context.use-case';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { checkVideoAccess } from '@/lib/modules/access';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { ok } from '@/lib/modules/shared/result';
import { CommentStatus } from '@prisma/client';

vi.mock('@/lib/modules/comments/infrastructure/comment.repository', () => ({ CommentRepository: vi.fn() }));
vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));

function comment(status: CommentStatus, authorDeleted = false) {
  return {
    id: 'c1',
    videoId: 'v1',
    parentId: null,
    authorId: 'author-1',
    text: 'held content',
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 0,
    reportsCount: 3,
    isHearted: false,
    author: { id: 'author-1', name: 'A', username: null, imageUrl: null, isDeleted: authorDeleted, role: 'USER', patronGrants: [] },
  };
}

describe('GET comment context (deep link) never leaks moderated content', () => {
  let repo: any;
  // The video's channel decides who moderates (owner 'creator-1'); it is loaded through the authorization layer.
  const prisma = { video: { findUnique: vi.fn().mockResolvedValue({ creator: { id: 'ch1', userId: 'creator-1', status: 'ACTIVE', members: [] } }) } };
  const as = (actor: any) => createAppContext({ actor, prisma: prisma as any });

  beforeEach(() => {
    vi.clearAllMocks();
    repo = { findCommentById: vi.fn(), findCommentForDto: vi.fn(), findVideoCreatorId: vi.fn().mockResolvedValue('creator-1') };
    vi.mocked(CommentRepository).mockImplementation(function () { return repo; } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: true } as any));
  });

  it.each([CommentStatus.HELD_FOR_REVIEW, CommentStatus.HIDDEN, CommentStatus.DELETED])(
    'answers NOT_FOUND for a %s comment to a regular viewer',
    async (status) => {
      repo.findCommentById.mockResolvedValue(comment(status));
      const result = await getCommentContext({ commentId: 'c1' }, as({ type: 'user', userId: 'someone' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
      expect(repo.findCommentForDto).not.toHaveBeenCalled();
    },
  );

  it('answers NOT_FOUND for a comment of a deleted account', async () => {
    repo.findCommentById.mockResolvedValue(comment(CommentStatus.VISIBLE, true));
    const result = await getCommentContext({ commentId: 'c1' }, as({ type: 'user', userId: 'someone' }));
    expect(result.ok).toBe(false);
  });

  it('lets the video creator review a held comment', async () => {
    repo.findCommentById.mockResolvedValue(comment(CommentStatus.HELD_FOR_REVIEW));
    repo.findCommentForDto.mockResolvedValue(comment(CommentStatus.HELD_FOR_REVIEW));
    const result = await getCommentContext({ commentId: 'c1' }, as({ type: 'user', userId: 'creator-1' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.comment.text).toBe('held content');
  });
});
