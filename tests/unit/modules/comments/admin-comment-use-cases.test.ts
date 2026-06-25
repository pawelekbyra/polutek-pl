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
  it('listAdminComments should pass video filter to repository', async () => { mockRepo.findAdminComments.mockResolvedValue([]); const result = await listAdminComments({ q: 'tekst', status: CommentStatus.VISIBLE, videoId: 'video-1', limit: 25 }, ctx); expect(result.ok).toBe(true); expect(mockRepo.findAdminComments).toHaveBeenCalledWith({ q: 'tekst', status: CommentStatus.VISIBLE, videoId: 'video-1', limit: 25 }); });
  it('listCommentReports should fail if not admin', async () => { ctx.actor.type = 'user'; const result = await listCommentReports(undefined, ctx); expect(result.ok).toBe(false); expect((result as any).error?.message).toBe('Brak uprawnień administratora.'); });
  it('listCommentReports should return reports', async () => { mockRepo.findReports.mockResolvedValue([{ id: 'r1' }]); const result = await listCommentReports(CommentReportStatus.PENDING, ctx); expect(result.ok).toBe(true); expect((result as any).data).toEqual([{ id: 'r1' }]); });
  it('toggleAdminCommentHeart should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1' }); mockRepo.toggleHeart.mockResolvedValue({ isHearted: true }); const result = await toggleAdminCommentHeart('c1', ctx); expect(result.ok).toBe(true); expect(recordAuditEvent).toHaveBeenCalled(); });
  it('hideAdminComment should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1' }); const result = await hideAdminComment('c1', ctx); expect(result.ok).toBe(true); expect(mockRepo.updateCommentStatus).toHaveBeenCalled(); });
  it('restoreAdminComment should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1' }); const result = await restoreAdminComment('c1', ctx); expect(result.ok).toBe(true); expect(mockRepo.updateCommentStatus).toHaveBeenCalled(); });
  it('deleteAdminComment should work', async () => { mockRepo.findCommentById.mockResolvedValue({ id: 'c1', status: CommentStatus.VISIBLE }); const result = await deleteAdminComment({ commentId: 'c1' }, ctx); expect(result.ok).toBe(true); expect(mockRepo.softDelete).toHaveBeenCalled(); });
  it('resolveCommentReport should work', async () => { mockRepo.findReportById.mockResolvedValue({ id: 'r1', commentId: 'c1' }); mockRepo.resolveReport.mockResolvedValue({ id: 'r1' }); const result = await resolveCommentReport('r1', CommentReportStatus.ACTION_TAKEN, ctx); expect(result.ok).toBe(true); expect(mockRepo.resolveReport).toHaveBeenCalled(); });
});
