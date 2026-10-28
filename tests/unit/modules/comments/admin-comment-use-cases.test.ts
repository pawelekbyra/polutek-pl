import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdminComments } from '@/lib/modules/comments/application/list-admin-comments.use-case';
import { listCommentReports } from '@/lib/modules/comments/application/list-comment-reports.use-case';
import { toggleAdminCommentHeart } from '@/lib/modules/comments/application/toggle-admin-comment-heart.use-case';
import { hideAdminComment } from '@/lib/modules/comments/application/hide-admin-comment.use-case';
import { holdCommentForReview } from '@/lib/modules/comments/application/hold-comment-for-review.use-case';
import { approveHeldComment } from '@/lib/modules/comments/application/approve-held-comment.use-case';
import { restoreAdminComment } from '@/lib/modules/comments/application/restore-admin-comment.use-case';
import { deleteAdminComment } from '@/lib/modules/comments/application/delete-admin-comment.use-case';
import { resolveCommentReport } from '@/lib/modules/comments/application/resolve-comment-report.use-case';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { recordAuditEvent } from '@/lib/modules/audit';
import { AppContext, createAppContext } from '@/lib/modules/shared/app-context';
import { CommentStatus, CommentReportStatus, CommentDeletedReason } from '@prisma/client';

vi.mock('@/lib/modules/comments/infrastructure/comment.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/modules/comments/infrastructure/comment.repository')>();
  return { ...actual, CommentRepository: vi.fn() };
});
vi.mock('@/lib/modules/audit');

describe('Admin Comment Use Cases', () => {
  let ctx: AppContext;
  let mockRepo: any;
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findAdminComments: vi.fn(),
      findReports: vi.fn(),
      findCommentById: vi.fn(),
      setHeart: vi.fn(),
      transitionStatus: vi.fn().mockResolvedValue(true),
      softDelete: vi.fn().mockResolvedValue(true),
      findReportById: vi.fn(),
      resolveReport: vi.fn(),
      refreshPendingReportsCount: vi.fn().mockResolvedValue(0),
      lockCommentForReports: vi.fn().mockResolvedValue(undefined),
    };
    (CommentRepository as any).mockImplementation(function() { return mockRepo; });
    ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: { $transaction: (fn: any) => fn({}) } as any });
  });

  it('listAdminComments should pass video filter and pagination to repository', async () => { mockRepo.findAdminComments.mockResolvedValue({ items: [], total: 0 }); const result = await listAdminComments({ q: 'tekst', status: CommentStatus.VISIBLE, videoId: 'video-1', page: 2, pageSize: 25 }, ctx); expect(result.ok).toBe(true); expect(mockRepo.findAdminComments).toHaveBeenCalledWith({ q: 'tekst', status: CommentStatus.VISIBLE, videoId: 'video-1', page: 2, pageSize: 25 }); });
  it('listAdminComments should return items/total/page/pageSize/totalPages instead of an unbounded array', async () => { const rawComment = { id: 'c1', videoId: 'v1', parentId: null, text: 'hi', status: CommentStatus.VISIBLE, author: null, createdAt: new Date(), updatedAt: new Date(), editedAt: null, deletedAt: null, deletedReason: null, pinnedAt: null, likesCount: 0 }; mockRepo.findAdminComments.mockResolvedValue({ items: [rawComment], total: 123 }); const result = await listAdminComments({ page: 1, pageSize: 50 }, ctx); expect(result.ok).toBe(true); expect((result as any).data.total).toBe(123); expect((result as any).data.totalPages).toBe(3); expect((result as any).data.page).toBe(1); expect((result as any).data.pageSize).toBe(50); expect((result as any).data.items).toHaveLength(1); });
  it('listCommentReports should fail if not admin', async () => { ctx.actor = { type: 'user', userId: 'u' }; const result = await listCommentReports(undefined, ctx); expect(result.ok).toBe(false); expect((result as any).error?.message).toBe('Brak uprawnień administratora.'); });
  it('listCommentReports should return reports', async () => { mockRepo.findReports.mockResolvedValue({ items: [{ id: 'r1' }], total: 1 }); const result = await listCommentReports(CommentReportStatus.PENDING, ctx); expect(result.ok).toBe(true); expect((result as any).data.items).toEqual([{ id: 'r1' }]); expect((result as any).data.total).toBe(1); });
  it('listCommentReports should pass pagination through to the repository', async () => { mockRepo.findReports.mockResolvedValue({ items: [], total: 45 }); const result = await listCommentReports({ status: CommentReportStatus.PENDING, page: 2, pageSize: 10 }, ctx); expect(result.ok).toBe(true); expect(mockRepo.findReports).toHaveBeenCalledWith({ status: CommentReportStatus.PENDING, page: 2, pageSize: 10 }); expect((result as any).data).toEqual({ items: [], total: 45, page: 2, pageSize: 10, totalPages: 5 }); });

  it('listCommentReports does not show the text of a comment its author deleted', async () => {
    mockRepo.findReports.mockResolvedValue({
      items: [{ id: 'r1', comment: { id: 'c1', text: 'private', status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.AUTHOR_DELETED } }],
      total: 1,
    });
    const result = await listCommentReports(undefined, ctx);
    expect((result as any).data.items[0].comment.text).toBe('');
  });

  it('toggleAdminCommentHeart flips the stored value and returns it', async () => {
    mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.VISIBLE, isHearted: false });
    const result = await toggleAdminCommentHeart('c1', ctx);
    expect(result).toEqual({ ok: true, data: { isHearted: true } });
    expect(mockRepo.setHeart).toHaveBeenCalledWith('c1', true);
    expect(recordAuditEvent).toHaveBeenCalled();
  });

  describe('moderation state machine', () => {
    it('restores a hidden comment', async () => {
      mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.HIDDEN });
      const result = await restoreAdminComment('c1', ctx);
      expect(result.ok).toBe(true);
      expect(mockRepo.transitionStatus).toHaveBeenCalledWith('c1', [CommentStatus.HIDDEN, CommentStatus.HELD_FOR_REVIEW], expect.objectContaining({ status: CommentStatus.VISIBLE, moderatedById: 'admin-1' }));
    });

    it.each([CommentDeletedReason.AUTHOR_DELETED, CommentDeletedReason.MODERATOR_DELETED])(
      'refuses to restore a deleted comment (%s) instead of publishing it',
      async (deletedReason) => {
        mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.DELETED, deletedReason });
        const result = await restoreAdminComment('c1', ctx);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.type).toBe('CONFLICT');
        expect(mockRepo.transitionStatus).not.toHaveBeenCalled();
        expect(recordAuditEvent).not.toHaveBeenCalled();
      },
    );

    it('refuses to hide a deleted comment', async () => {
      mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.DELETED });
      const result = await hideAdminComment('c1', ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('CONFLICT');
    });

    it('approve only applies to held comments', async () => {
      mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.HIDDEN });
      const result = await approveHeldComment('c1', ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('CONFLICT');
    });

    it('repeating an action that already took effect is a no-op', async () => {
      mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.HELD_FOR_REVIEW });
      const result = await holdCommentForReview('c1', ctx);
      expect(result.ok).toBe(true);
      expect(mockRepo.transitionStatus).not.toHaveBeenCalled();
    });

    it('reports a CONFLICT when another moderator changed the status meanwhile', async () => {
      mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.VISIBLE });
      mockRepo.transitionStatus.mockResolvedValue(false);
      const result = await hideAdminComment('c1', ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('CONFLICT');
      expect(recordAuditEvent).not.toHaveBeenCalled();
    });

    it('NOT_FOUND for a missing comment', async () => {
      mockRepo.findCommentById.mockResolvedValue(null);
      const result = await hideAdminComment('missing', ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
    });

    it('never passes a database error message to the client', async () => {
      mockRepo.findCommentById.mockRejectedValue(new Error('relation "Comment" violates constraint comment_pkey'));
      const result = await hideAdminComment('c1', ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('DATABASE_ERROR');
        expect(result.error.message).not.toMatch(/Comment"|constraint/);
      }
    });
  });

  it('deleteAdminComment keeps the content (status only) and audits once', async () => {
    mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.VISIBLE });
    const result = await deleteAdminComment({ commentId: 'c1' }, ctx);
    expect(result.ok).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith('c1', expect.objectContaining({ deletedReason: 'MODERATOR_DELETED', deletedById: 'admin-1' }));
    expect(mockRepo.softDelete.mock.calls[0][1]).not.toHaveProperty('text');
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
  });

  it('deleteAdminComment on an already deleted comment changes nothing', async () => {
    mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.DELETED });
    mockRepo.softDelete.mockResolvedValue(false);
    const result = await deleteAdminComment({ commentId: 'c1' }, ctx);
    expect(result.ok).toBe(true);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('resolveCommentReport recomputes the pending reports count', async () => {
    mockRepo.findReportById.mockResolvedValue({ id: 'r1', commentId: 'c1' });
    mockRepo.resolveReport.mockResolvedValue({ id: 'r1', status: CommentReportStatus.DISMISSED });
    const result = await resolveCommentReport('r1', CommentReportStatus.DISMISSED, ctx);
    expect(result.ok).toBe(true);
    expect(mockRepo.refreshPendingReportsCount).toHaveBeenCalledWith('c1');
    // The recount queues up behind new reports of the same comment (audit W18).
    expect(mockRepo.lockCommentForReports).toHaveBeenCalledWith('c1');
    expect(mockRepo.lockCommentForReports.mock.invocationCallOrder[0]).toBeLessThan(mockRepo.resolveReport.mock.invocationCallOrder[0]);
  });
});
