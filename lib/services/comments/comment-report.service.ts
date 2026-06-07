import { prisma } from '@/lib/prisma';
import { CommentReportReason } from '@prisma/client';

import { CommentStatus } from '@prisma/client';
import { logCommentAction } from './comment-audit.service';
import { CommentAccessService } from './comment-access.service';

export class CommentReportService {
  static async report(userId: string, commentId: string, reason: CommentReportReason, note?: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, videoId: true, status: true }
    });

    if (!comment) throw new Error("Comment not found");
    if (comment.status === CommentStatus.DELETED) throw new Error("Cannot report deleted comment");
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
}
