import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportComment, REPORT_HOLD_THRESHOLD } from '@/lib/modules/comments/application/report-comment.use-case';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { checkVideoAccess } from '@/lib/modules/access';
import { recordAuditEventSafe } from '@/lib/modules/audit';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { ok } from '@/lib/modules/shared/result';
import { CommentStatus } from '@prisma/client';

vi.mock('@/lib/modules/comments/infrastructure/comment.repository', () => ({ CommentRepository: vi.fn() }));
vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEventSafe: vi.fn() }));

describe('reportComment', () => {
  let repo: any;
  const ctx = () =>
    createAppContext({ actor: { type: 'user', userId: 'reporter-1' }, prisma: { $transaction: (fn: any) => fn({}) } as any });

  const commentBy = (author: { id: string; role: 'USER' | 'ADMIN' }) => ({
    id: 'c1',
    videoId: 'v1',
    authorId: author.id,
    status: CommentStatus.VISIBLE,
    author: { ...author, isDeleted: false },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo = {
      findCommentById: vi.fn().mockResolvedValue(commentBy({ id: 'viewer-9', role: 'USER' })),
      findVideoCreatorId: vi.fn().mockResolvedValue('creator-1'),
      lockCommentForReports: vi.fn().mockResolvedValue(undefined),
      createReport: vi.fn().mockResolvedValue(true),
      refreshPendingReportsCount: vi.fn().mockResolvedValue(REPORT_HOLD_THRESHOLD),
      transitionStatus: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(CommentRepository).mockImplementation(function () { return repo; } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: true } as any));
  });

  it('holds a regular viewer comment for review once enough people reported it', async () => {
    const result = await reportComment({ commentId: 'c1', reason: 'SPAM' }, ctx());
    expect(result.ok).toBe(true);
    expect(repo.transitionStatus).toHaveBeenCalledWith('c1', [CommentStatus.VISIBLE], expect.objectContaining({ status: CommentStatus.HELD_FOR_REVIEW }));
  });

  it('locks the comment before it writes and counts reports (parallel reports cannot all see a count of 1)', async () => {
    await reportComment({ commentId: 'c1', reason: 'SPAM' }, ctx());
    expect(repo.lockCommentForReports).toHaveBeenCalledWith('c1');
    const order = (fn: any) => fn.mock.invocationCallOrder[0];
    expect(order(repo.lockCommentForReports)).toBeLessThan(order(repo.createReport));
    expect(order(repo.createReport)).toBeLessThan(order(repo.refreshPendingReportsCount));
  });

  it('stays visible below the threshold', async () => {
    repo.refreshPendingReportsCount.mockResolvedValue(REPORT_HOLD_THRESHOLD - 1);
    await reportComment({ commentId: 'c1', reason: 'SPAM' }, ctx());
    expect(repo.transitionStatus).not.toHaveBeenCalled();
  });

  it.each([
    ['the video creator', { id: 'creator-1', role: 'USER' as const }],
    ['an admin', { id: 'admin-7', role: 'ADMIN' as const }],
  ])('never hides a comment of %s automatically (reports still land in the queue)', async (_label, author) => {
    repo.findCommentById.mockResolvedValue(commentBy(author));
    const result = await reportComment({ commentId: 'c1', reason: 'HATE' }, ctx());
    expect(result.ok).toBe(true);
    expect(repo.createReport).toHaveBeenCalled();
    expect(repo.transitionStatus).not.toHaveBeenCalled();
  });

  it('a second report by the same user is a no-op (no count change, no audit)', async () => {
    repo.createReport.mockResolvedValue(false);
    const result = await reportComment({ commentId: 'c1', reason: 'SPAM' }, ctx());
    expect(result.ok).toBe(true);
    expect(repo.refreshPendingReportsCount).not.toHaveBeenCalled();
    expect(recordAuditEventSafe).not.toHaveBeenCalled();
  });

  it('keeps the free-text note out of the audit log', async () => {
    await reportComment({ commentId: 'c1', reason: 'OTHER', note: 'personal details here' }, ctx());
    expect(vi.mocked(recordAuditEventSafe).mock.calls[0][1].metadata).toEqual({ reason: 'OTHER' });
  });
});
