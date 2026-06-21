import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentRepository, commentInclude } from '@/lib/modules/comments/infrastructure/comment.repository';
import { CommentStatus, Prisma } from '@prisma/client';

describe('CommentRepository', () => {
  let mockPrisma: any;
  let repository: CommentRepository;
  const videoId = 'video-1';

  beforeEach(() => {
    mockPrisma = {
      comment: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    repository = new CommentRepository(mockPrisma);
  });

  describe('visibleCommentStatusFilter (via findMany/count)', () => {
    it('count({ includeHidden: false }) should count only VISIBLE comments', async () => {
      mockPrisma.comment.count.mockResolvedValue(5);

      const count = await repository.count({ videoId, includeHidden: false });

      expect(count).toBe(5);
      expect(mockPrisma.comment.count).toHaveBeenCalledWith({
        where: {
          videoId,
          parentId: null,
          status: CommentStatus.VISIBLE,
        },
      });
    });

    it('count({ includeHidden: true }) should exclude DELETED comments', async () => {
      mockPrisma.comment.count.mockResolvedValue(10);

      const count = await repository.count({ videoId, includeHidden: true });

      expect(count).toBe(10);
      expect(mockPrisma.comment.count).toHaveBeenCalledWith({
        where: {
          videoId,
          parentId: null,
          status: { not: CommentStatus.DELETED },
        },
      });
    });

    it('findMany({ includeHidden: false }) should filter by VISIBLE status', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([]);

      await repository.findMany({ videoId, sortBy: 'newest', limit: 10, includeHidden: false });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CommentStatus.VISIBLE,
          }),
        })
      );
    });

    it('findMany({ includeHidden: true }) should exclude DELETED status', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([]);

      await repository.findMany({ videoId, sortBy: 'newest', limit: 10, includeHidden: true });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: CommentStatus.DELETED },
          }),
        })
      );
    });

    it('findReplies({ includeHidden: true }) should exclude DELETED status', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([]);

      await repository.findReplies('parent-1', 'user-1', true);

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: 'parent-1',
            status: { not: CommentStatus.DELETED },
          }),
        })
      );
    });
  });

  describe('commentInclude nested replies filter', () => {
    it('uses VISIBLE status when includeHidden is false', () => {
      const include = commentInclude('user-1', false);
      expect((include.replies.where as any).status).toBe(CommentStatus.VISIBLE);
    });

    it('uses not DELETED status when includeHidden is true', () => {
      const include = commentInclude('user-1', true);
      expect((include.replies.where as any).status).toEqual({ not: CommentStatus.DELETED });
    });
  });
});
