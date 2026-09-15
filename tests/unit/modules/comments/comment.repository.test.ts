import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentRepository, commentInclude } from '@/lib/modules/comments/infrastructure/comment.repository';
import { CommentStatus, CommentReportStatus, Prisma } from '@prisma/client';

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
      commentReport: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    repository = new CommentRepository(mockPrisma);
  });

  describe('findReports pagination', () => {
    it('bounds the query with take/skip and returns items + total instead of an unbounded array', async () => {
      mockPrisma.commentReport.findMany.mockResolvedValue([{ id: 'r1' }]);
      mockPrisma.commentReport.count.mockResolvedValue(57);

      const result = await repository.findReports({ page: 3, pageSize: 20 });

      expect(mockPrisma.commentReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 40 })
      );
      expect(mockPrisma.commentReport.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ items: [{ id: 'r1' }], total: 57 });
    });

    it('defaults to page 1 / pageSize 20 when no options are given', async () => {
      mockPrisma.commentReport.findMany.mockResolvedValue([]);
      mockPrisma.commentReport.count.mockResolvedValue(0);

      await repository.findReports();

      expect(mockPrisma.commentReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 })
      );
    });

    it('filters by status while still applying pagination', async () => {
      mockPrisma.commentReport.findMany.mockResolvedValue([]);
      mockPrisma.commentReport.count.mockResolvedValue(0);

      await repository.findReports({ status: CommentReportStatus.PENDING, page: 2, pageSize: 5 });

      expect(mockPrisma.commentReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: CommentReportStatus.PENDING }, take: 5, skip: 5 })
      );
      expect(mockPrisma.commentReport.count).toHaveBeenCalledWith({ where: { status: CommentReportStatus.PENDING } });
    });
  });

  describe('findAdminComments pagination', () => {
    it('bounds the query with take/skip and returns items + total instead of an unbounded array', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.comment.count.mockResolvedValue(120);

      const result = await repository.findAdminComments({ page: 3, pageSize: 50 });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 100 })
      );
      expect(mockPrisma.comment.count).toHaveBeenCalled();
      expect(result).toEqual({ items: [{ id: 'c1' }], total: 120 });
    });

    it('defaults to page 1 / pageSize 50 when no options are given', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([]);
      mockPrisma.comment.count.mockResolvedValue(0);

      await repository.findAdminComments({});

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 })
      );
    });

    it('applies q/status/videoId filters identically to both findMany and count', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([]);
      mockPrisma.comment.count.mockResolvedValue(0);

      await repository.findAdminComments({ q: 'spam', status: CommentStatus.HIDDEN, videoId: 'video-1', page: 2, pageSize: 20 });

      const expectedWhere = {
        AND: [
          { text: { contains: 'spam', mode: 'insensitive' } },
          { status: CommentStatus.HIDDEN },
          { videoId: 'video-1' },
        ],
      };
      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere, take: 20, skip: 20 })
      );
      expect(mockPrisma.comment.count).toHaveBeenCalledWith({ where: expectedWhere });
    });
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
