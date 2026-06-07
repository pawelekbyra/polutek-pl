import { prisma } from '@/lib/prisma';
import { CommentReportReason, CommentReportStatus, CommentStatus } from '@prisma/client';
import { logCommentAction } from './comment-audit.service';
import { CommentAccessService } from './comment-access.service';

export class CommentReportService {
  static async getReports(status?: CommentReportStatus) {
    return prisma.commentReport.findMany({
      where: status ? { status } : {},
      include: {
        comment: {
          include: {
            author: true,
            video: {
                select: { id: true, title: true, slug: true }
            }
          }
        },
        reporter: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async report(userId: string, commentId: string, reason: CommentReportReason, note?: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, videoId: true, status: true }
    });

    if (!comment) throw new Error("Comment not found");
    if (comment.status === CommentStatus.DELETED) throw new Error("Cannot report deleted comment");

    // Normal users can only report VISIBLE comments
    if (comment.status !== 'VISIBLE') throw new Error("Comment is not reportable");
    if (comment.authorId === userId) throw new Error("Cannot report your own comment");

    const canView = await CommentAccessService.canViewComments(userId, comment.videoId);
    if (!canView) throw new Error("Forbidden");

    const existing = await prisma.commentReport.findUnique({
      where: { commentId_reporterId: { commentId, reporterId: userId } }
    });

    if (existing) return existing;

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.commentReport.create({
        data: { commentId, reporterId: userId, reason, note }
      });
      await tx.comment.update({
        where: { id: commentId },
        data: { reportsCount: { increment: 1 } }
      });
      return report;
    });

    await logCommentAction(userId, 'REPORT', commentId, comment.videoId, { reason });
    return result;
  }

  static async resolveReport(reportId: string, actorId: string, status: CommentReportStatus) {
    const report = await prisma.commentReport.update({
      where: { id: reportId },
      data: {
        status,
        resolvedAt: new Date(),
        resolvedById: actorId
      },
      include: { comment: true }
    });

    await logCommentAction(actorId, `REPORT_${status}`, report.commentId, report.comment.videoId, { reportId });
    return report;
  }
}
