import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdminComments } from '@/lib/modules/comments/application/list-admin-comments.use-case';
import { listCommentReports } from '@/lib/modules/comments/application/list-comment-reports.use-case';
import { toggleAdminCommentHeart } from '@/lib/modules/comments/application/toggle-admin-comment-heart.use-case';
import { hideAdminComment } from '@/lib/modules/comments/application/hide-admin-comment.use-case';
import { restoreAdminComment } from '@/lib/modules/comments/application/restore-admin-comment.use-case';
import { deleteAdminComment } from '@/lib/modules/comments/application/delete-admin-comment.use-case';
import { resolveCommentReport } from '@/lib/modules/comments/application/resolve-comment-report.use-case';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { recordAuditEvent } from '@/lib/modules/audit';
import { AppContext } from '@/lib/modules/shared/app-context';
import { CommentStatus, CommentReportStatus } from '@prisma/client';

vi.mock('@/lib/modules/comments/infrastructure/comment.repository', () => { return { CommentRepository: vi.fn() }; });
vi.mock('@/lib/modules/audit');

describe('Admin Comment Use Cases', () => {
  let ctx: AppContext;
  let mockRepo: any;
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = { findAdminComments: vi.fn(), findReports: vi.fn(), findCommentById: vi.fn(), toggleHeart: vi.fn(), updateCommentStatus: vi.fn(), softDelete: vi.fn(), findReportById: vi.fn(), resolveReport: vi.fn() };
    (CommentRepository as any).mockImplementation(function() { return mockRepo; });
    ctx = { actor: { type: 'admin', userId: 'admin-1' }, prisma: {} as any } as any;
  });
  it('listAdminComments should pass video filter and pagination to repository', async () => { mockRepo.findAdminComments.mockResolvedValue({ items: [], total: 0 }); const result = await listAdminComments({ q: 'tekst', status: CommentStatus.VISIBLE, videoId: 'video-1', page: 2, pageSize: 25 }, ctx); expect(result.ok).toBe(true); expect(mockRepo.findAdminComments).toHaveBeenCalledWith({ q: 'tekst', status: CommentStatus.VISIBLE, videoId: 'video-1', page: 2, pageSize: 25 }); });
  it('listAdminComments should return items/total/page/pageSize/totalPages instead of an unbounded array', async () => { const rawComment = { id: 'c1', videoId: 'v1', parentId: null, text: 'hi', imageUrl: null, status: CommentStatus.VISIBLE, author: null, createdAt: new Date(), updatedAt: new Date(), editedAt: null, deletedAt: null, deletedReason: null, pinnedAt: null, likesCount: 0 }; mockRepo.findAdminComments.mockResolvedValue({ items: [rawComment], total: 123 }); const result = await listAdminComments({ page: 1, pageSize: 50 }, ctx); expect(result.ok).toBe(true); expect((result as any).data.total).toBe(123); expect((result as any).data.totalPages).toBe(3); expect((result as any).data.page).toBe(1); expect((result as any).data.pageSize).toBe(50); expect((result as any).data.items).toHaveLength(1); });
  it('listCommentReports should fail if not admin', async () => { ctx.actor.type = 'user'; const result = await listCommentReports(undefined, ctx); expect(result.ok).toBe(false); expect((result as any).error?.message).toBe('Brak uprawnień administratora.'); });
  it('listCommentReports should return reports', async () => { mockRepo.findReports.mockResolvedValue({ items: [{ id: 'r1' }], total: 1 }); const result = await listCommentReports(CommentReportStatus.PENDING, ctx); expect(result.ok).toBe(true); expect((result as any).data.items).toEqual([{ id: 'r1' }]); expect((result as any).data.total).toBe(1); });
  it('listCommentReports should pass pagination through to the repository', async () => { mockRepo.findReports.mockResolvedValue({ items: [], total: 45 }); const result = await listCommentReports({ status: CommentReportStatus.PENDING, page: 2, pageSize: 10 }, ctx); expect(result.ok).toBe(true); expect(mockRepo.findReports).toHaveBeenCalledWith({ status: CommentReportStatus.PENDING, page: 2, pageSize: 10 }); expect((result as any).data).toEqual({ items: [], total: 45, page: 2, pageSize: 10, totalPages: 5 }); });
  it('toggleAdminCommentHeart should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1' }); mockRepo.toggleHeart.mockResolvedValue({ isHearted: true }); const result = await toggleAdminCommentHeart('c1', ctx); expect(result.ok).toBe(true); expect(recordAuditEvent).toHaveBeenCalled(); });
  it('hideAdminComment should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1' }); const result = await hideAdminComment('c1', ctx); expect(result.ok).toBe(true); expect(mockRepo.updateCommentStatus).toHaveBeenCalled(); });
  it('restoreAdminComment should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1' }); const result = await restoreAdminComment('c1', ctx); expect(result.ok).toBe(true); expect(mockRepo.updateCommentStatus).toHaveBeenCalled(); });
  it('deleteAdminComment should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.VISIBLE }); const result = await deleteAdminComment({ commentId: 'c1' }, ctx); expect(result.ok).toBe(true); expect(mockRepo.softDelete).toHaveBeenCalled(); });
  it('resolveCommentReport should work', async () => { mockRepo.findReportById.mockResolvedValue({ id: 'r1', commentId: 'c1' }); mockRepo.resolveReport.mockResolvedValue({ id: 'r1' }); const result = await resolveCommentReport('r1', CommentReportStatus.ACTION_TAKEN, ctx); expect(result.ok).toBe(true); expect(mockRepo.resolveReport).toHaveBeenCalled(); });
});
