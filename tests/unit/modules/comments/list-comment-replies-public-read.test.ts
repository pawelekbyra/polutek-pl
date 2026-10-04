import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCommentReplies } from '@/lib/modules/comments/application/list-comment-replies.use-case';
import { checkVideoAccess } from '@/lib/modules/access';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { ok } from '@/lib/modules/shared/result';
import { CommentStatus } from '@prisma/client';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/modules/comments/infrastructure/comment.repository', () => ({
  CommentRepository: vi.fn(function CommentRepositoryMock() {}),
}));

function reply(id: string) {
  return {
    id,
    videoId: 'video-1',
    parentId: 'comment-1',
    authorId: 'u',
    text: `reply ${id}`,
    status: CommentStatus.VISIBLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 0,
    reportsCount: 0,
    isHearted: false,
    author: { id: 'u', name: 'U', username: null, imageUrl: null, isDeleted: false, role: 'USER', patronGrants: [] },
  };
}

describe('listCommentReplies', () => {
  const parentComment = { id: 'comment-1', videoId: 'video-1', status: CommentStatus.VISIBLE, deletedReason: null, author: { isDeleted: false } };
  const repo = {
    findCommentById: vi.fn(),
    findVideoCreatorId: vi.fn(),
    findReplies: vi.fn(),
  };
  const guest = () => createAppContext({ actor: { type: 'guest' }, prisma: {} as any });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CommentRepository).mockImplementation(function CommentRepositoryMock() { return repo as any; });
    repo.findCommentById.mockResolvedValue(parentComment);
    repo.findVideoCreatorId.mockResolvedValue('creator-1');
    repo.findReplies.mockResolvedValue([]);
  });

  it('allows guests to read replies on a login-required video', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: false, reason: 'LOGIN_REQUIRED' } as any));
    const result = await listCommentReplies({ commentId: parentComment.id, limit: 10 }, guest());
    expect(result.ok).toBe(true);
    expect(repo.findReplies).toHaveBeenCalled();
  });

  it('still fails when the video is missing or deleted', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: false, reason: 'NOT_FOUND' } as any));
    const result = await listCommentReplies({ commentId: parentComment.id, limit: 10 }, guest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
    expect(repo.findReplies).not.toHaveBeenCalled();
  });

  it('pages through every reply: a full page reports the next cursor, the last page none', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: true } as any));
    repo.findReplies.mockResolvedValueOnce([reply('r1'), reply('r2'), reply('r3')]);
    const first = await listCommentReplies({ commentId: 'comment-1', limit: 2 }, guest());
    expect(repo.findReplies).toHaveBeenLastCalledWith('comment-1', null, false, undefined, 3);
    expect(first.ok && first.data.replies.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(first.ok && first.data.nextCursor).toBe('r2');

    repo.findReplies.mockResolvedValueOnce([reply('r3')]);
    const second = await listCommentReplies({ commentId: 'comment-1', cursor: 'r2', limit: 2 }, guest());
    expect(repo.findReplies).toHaveBeenLastCalledWith('comment-1', null, false, 'r2', 3);
    expect(second.ok && second.data.replies.map((r) => r.id)).toEqual(['r3']);
    expect(second.ok && second.data.nextCursor).toBeNull();
  });

  it('clamps the page size to 1..50', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: true } as any));
    await listCommentReplies({ commentId: 'comment-1', limit: 100000 }, guest());
    expect(repo.findReplies).toHaveBeenLastCalledWith('comment-1', null, false, undefined, 51);
    await listCommentReplies({ commentId: 'comment-1', limit: -5 }, guest());
    expect(repo.findReplies).toHaveBeenLastCalledWith('comment-1', null, false, undefined, 2);
  });

  it.each([CommentStatus.HIDDEN, CommentStatus.HELD_FOR_REVIEW, CommentStatus.DELETED])(
    'does not reveal the thread of a %s comment to a viewer',
    async (status) => {
      vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: true } as any));
      repo.findCommentById.mockResolvedValue({ ...parentComment, status });
      const result = await listCommentReplies({ commentId: 'comment-1', limit: 10 }, guest());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
      expect(repo.findReplies).not.toHaveBeenCalled();
    },
  );
});
