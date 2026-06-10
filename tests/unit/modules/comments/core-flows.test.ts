import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listVideoComments } from '@/lib/modules/comments/application/list-video-comments.use-case';
import { createVideoComment } from '@/lib/modules/comments/application/create-video-comment.use-case';
import { updateComment } from '@/lib/modules/comments/application/update-comment.use-case';
import { deleteComment } from '@/lib/modules/comments/application/delete-comment.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { recordAuditEvent } from '@/lib/modules/audit';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Comments Core Use Cases', () => {
  let mockPrisma: any;
  const videoId = 'v1';
  const userId = 'u1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      comment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      video: {
        findUnique: vi.fn(),
      },
      commentReport: {
          findUnique: vi.fn(),
          create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
  });

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma });

  describe('listVideoComments', () => {
    it('denies if video is not found via access check', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'NOT_FOUND' } });
      const result = await listVideoComments({ videoId, sortBy: 'newest', limit: 10 }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
    });

    it('denies viewing comments if PATRON_REQUIRED and not patron', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'PATRON_REQUIRED' } });
      mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'admin' } });

      const result = await listVideoComments({ videoId, sortBy: 'newest', limit: 10 }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    });
  });

  describe('createVideoComment', () => {
    it('denies non-patron on patron-only video (returns FORBIDDEN)', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'PATRON_REQUIRED' } });
      mockPrisma.video.findUnique.mockResolvedValue({ id: videoId, creatorId: 'c1' });
      const result = await createVideoComment({ videoId, text: 'hello' }, createCtx({ type: 'user', userId, isPatron: false }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
          expect(result.error.type).toBe('FORBIDDEN');
          expect(result.error.message).toContain('Patronów');
      }
    });

    it('allows patron on patron-only video', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
      mockPrisma.video.findUnique.mockResolvedValue({ id: videoId, creatorId: 'c1' });
      mockPrisma.comment.create.mockResolvedValue({ id: 'new-c', createdAt: new Date(), updatedAt: new Date() });
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'new-c', videoId, createdAt: new Date(), updatedAt: new Date(), author: { id: userId, role: 'USER' }, reactions: [] });

      const result = await createVideoComment({ videoId, text: 'hello' }, createCtx({ type: 'user', userId, isPatron: true }));
      expect(result.ok).toBe(true);
    });
  });

  describe('updateComment', () => {
    it('denies non-owner', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', authorId: 'other', status: 'VISIBLE' });
      const result = await updateComment({ commentId: 'c1', text: 'new text' }, createCtx({ type: 'user', userId, isPatron: false }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    });

    it('allows owner', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', authorId: userId, videoId, status: 'VISIBLE', createdAt: new Date(), updatedAt: new Date(), author: { id: userId, role: 'USER' }, reactions: [] });
      mockPrisma.comment.update.mockResolvedValue({ id: 'c1' });
      mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'admin' } });

      const result = await updateComment({ commentId: 'c1', text: 'new text' }, createCtx({ type: 'user', userId, isPatron: false }));
      expect(result.ok).toBe(true);
    });
  });

  describe('deleteComment', () => {
    it('allows moderator to delete', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', authorId: 'other', videoId });
      mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'mod' } });

      const result = await deleteComment({ commentId: 'c1' }, createCtx({ type: 'user', userId: 'mod', isPatron: false }));
      expect(result.ok).toBe(true);
    });

    it('denies regular user deleting someone else comment', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', authorId: 'other', videoId });
      mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'mod' } });

      const result = await deleteComment({ commentId: 'c1' }, createCtx({ type: 'user', userId: 'user2', isPatron: false }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    });
  });
});
