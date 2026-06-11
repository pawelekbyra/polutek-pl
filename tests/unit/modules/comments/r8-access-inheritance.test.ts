import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pinComment } from '@/lib/modules/comments/application/pin-comment.use-case';
import { unpinComment } from '@/lib/modules/comments/application/unpin-comment.use-case';
import { reportComment } from '@/lib/modules/comments/application/report-comment.use-case';
import { toggleCommentLike } from '@/lib/modules/comments/application/toggle-comment-like.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { CommentStatus } from '@prisma/client';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('R8 Comments Access and Permissions', () => {
  let mockPrisma: any;
  const videoId = 'v1';
  const userId = 'u1';
  const creatorId = 'c1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      comment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      video: {
        findUnique: vi.fn(),
      },
      commentReaction: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      commentReport: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
  });

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma });

  describe('Pin/Unpin Permissions', () => {
    it('allows global admin to pin', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', videoId, status: CommentStatus.VISIBLE });
      mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: creatorId } });

      const result = await pinComment({ commentId: 'c1' }, createCtx({ type: 'admin', userId: 'admin' }));
      expect(result.ok).toBe(true);
    });

    it('allows video creator to pin', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', videoId, status: CommentStatus.VISIBLE });
      mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: creatorId } });

      const result = await pinComment({ commentId: 'c1' }, createCtx({ type: 'user', userId: creatorId }));
      expect(result.ok).toBe(true);
    });

    it('denies regular user to pin', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', videoId, status: CommentStatus.VISIBLE });
      mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: creatorId } });

      const result = await pinComment({ commentId: 'c1' }, createCtx({ type: 'user', userId: 'other' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    });

    it('denies guest to pin', async () => {
      const result = await pinComment({ commentId: 'c1' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('UNAUTHORIZED');
    });
  });

  describe('Guest Interaction Blocking', () => {
    it('blocks guest from liking a comment', async () => {
      const result = await toggleCommentLike({ commentId: 'c1', action: 'LIKE' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('UNAUTHORIZED');
    });

    it('blocks guest from reporting a comment', async () => {
      const result = await reportComment({ commentId: 'c1', reason: 'SPAM' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('UNAUTHORIZED');
    });
  });

  describe('Patron-only Video Inheritance', () => {
    beforeEach(() => {
        (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'PATRON_REQUIRED' } });
    });

    it('allows guest to list comments on patron-only video but blocks interaction', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([]);
      mockPrisma.comment.count.mockResolvedValue(0);
      mockPrisma.video.findUnique.mockResolvedValue({ id: videoId, creator: { userId: creatorId } });

      const result = await (await import('@/lib/modules/comments/application/list-video-comments.use-case')).listVideoComments(
        { videoId, sortBy: 'newest', limit: 10 },
        createCtx({ type: 'guest' })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.viewer.canComment).toBe(false);
        expect(result.data.viewer.canReact).toBe(false);
        expect(result.data.viewer.canReport).toBe(false);
      }
    });

    it('allows non-patron to list comments on patron-only video but blocks interaction', async () => {
        mockPrisma.comment.findMany.mockResolvedValue([]);
        mockPrisma.comment.count.mockResolvedValue(0);
        mockPrisma.video.findUnique.mockResolvedValue({ id: videoId, creator: { userId: creatorId } });

        const result = await (await import('@/lib/modules/comments/application/list-video-comments.use-case')).listVideoComments(
          { videoId, sortBy: 'newest', limit: 10 },
          createCtx({ type: 'user', userId, isPatron: false })
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.viewer.canComment).toBe(false);
          expect(result.data.viewer.canReact).toBe(false);
          expect(result.data.viewer.canReport).toBe(false);
        }
    });

    it('blocks non-patron from liking a comment on patron-only video', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', videoId });
      const result = await toggleCommentLike({ commentId: 'c1', action: 'LIKE' }, createCtx({ type: 'user', userId, isPatron: false }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    });

    it('blocks non-patron from reporting a comment on patron-only video', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', videoId, authorId: 'other' });
      const result = await reportComment({ commentId: 'c1', reason: 'SPAM' }, createCtx({ type: 'user', userId, isPatron: false }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    });
  });

  describe('Read Denial Persistence', () => {
    it('blocks comment reading if video is NOT_FOUND', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'NOT_FOUND' } });

      const result = await (await import('@/lib/modules/comments/application/list-video-comments.use-case')).listVideoComments(
        { videoId, sortBy: 'newest', limit: 10 },
        createCtx({ type: 'guest' })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
    });

    it('blocks comment reading if video is DELETED', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'DELETED' } });

      const result = await (await import('@/lib/modules/comments/application/list-video-comments.use-case')).listVideoComments(
        { videoId, sortBy: 'newest', limit: 10 },
        createCtx({ type: 'guest' })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
    });
  });
});
