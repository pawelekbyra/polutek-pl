import { prisma } from '@/lib/prisma';
import { CommentStatus, CommentDeletedReason } from '@prisma/client';
import { logCommentAction } from './comment-audit.service';

export class CommentModerationService {
  static async hide(commentId: string, moderatorId: string) {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.HIDDEN,
        moderatedAt: new Date(),
        moderatedById: moderatorId
      }
    });
    await logCommentAction(moderatorId, 'HIDE', commentId, comment.videoId);
    return comment;
  }

  static async restore(commentId: string, moderatorId: string) {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.VISIBLE,
        moderatedAt: null,
        moderatedById: null
      }
    });
    await logCommentAction(moderatorId, 'RESTORE', commentId, comment.videoId);
    return comment;
  }

  static async softDelete(commentId: string, deletedById: string, reason: CommentDeletedReason) {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.DELETED,
        deletedAt: new Date(),
        deletedById,
        deletedReason: reason,
        text: "[deleted]",
        imageUrl: null
      }
    });
    await logCommentAction(deletedById, 'DELETE', commentId, comment.videoId, { reason });
    return comment;
  }
}
