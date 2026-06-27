import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCommentReplies } from '@/lib/modules/comments/application/list-comment-replies.use-case';
import { checkVideoAccess } from '@/lib/modules/access';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/modules/comments/infrastructure/comment.repository', () => {
  return {
    CommentRepository: vi.fn()
  };
});

describe('listCommentReplies public read access', () => {
  const parentComment = { id: 'comment-1', videoId: 'video-1' };
  const mockRepo = {
    findCommentById: vi.fn(),
    findVideoCreatorId: vi.fn(),
    findReplies: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (CommentRepository as any).mockImplementation(function(this: any) {
        return mockRepo;
    });
    mockRepo.findCommentById.mockResolvedValue(parentComment);
    mockRepo.findVideoCreatorId.mockResolvedValue('creator-1');
    mockRepo.findReplies.mockResolvedValue([]);
  });

  it('allows guests to read replies when video access is gated by patron status', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: false, reason: 'PATRON_REQUIRED' } as any));

    const result = await listCommentReplies(
      { commentId: parentComment.id, limit: 10 },
      createAppContext({ actor: { type: 'guest' }, prisma: {} as any }),
    );

    expect(result.ok).toBe(true);
    expect(mockRepo.findReplies).toHaveBeenCalled();
  });

  it('allows logged-in non-patrons to read replies when video access is login or patron gated', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: false, reason: 'LOGIN_REQUIRED' } as any));

    const result = await listCommentReplies(
      { commentId: parentComment.id, limit: 10 },
      createAppContext({ actor: { type: 'user', userId: 'user-1', isPatron: false }, prisma: {} as any }),
    );

    expect(result.ok).toBe(true);
    expect(mockRepo.findReplies).toHaveBeenCalled();
  });

  it('still fails when the gated video is missing or deleted', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: false, reason: 'NOT_FOUND' } as any));

    const result = await listCommentReplies(
      { commentId: parentComment.id, limit: 10 },
      createAppContext({ actor: { type: 'guest' }, prisma: {} as any }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
    expect(mockRepo.findReplies).not.toHaveBeenCalled();
  });
});
