import { prisma } from '@/lib/prisma';
import { CommentReportReason } from '@prisma/client';

export class CommentReportService {
  static async report(userId: string, commentId: string, reason: CommentReportReason, note?: string) {
    const existing = await prisma.commentReport.findUnique({
      where: { commentId_reporterId: { commentId, reporterId: userId } }
    });

    if (existing) return existing;

    return await prisma.$transaction(async (tx) => {
      const report = await tx.commentReport.create({
        data: { commentId, reporterId: userId, reason, note }
      });
      await tx.comment.update({
        where: { id: commentId },
        data: { reportsCount: { increment: 1 } }
      });
      return report;
    });
  }
}
