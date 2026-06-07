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

  static async softDelete(commentId: string, actorId: string, reason: CommentDeletedReason) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, videoId: true, parentId: true }
    });

    if (!comment) throw new Error("Comment not found");

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.comment.update({
        where: { id: commentId },
        data: {
          status: CommentStatus.DELETED,
          deletedAt: new Date(),
          deletedById: actorId,
          deletedReason: reason,
          text: "[deleted]",
          imageUrl: null
        }
      });

      if (comment.parentId) {
        await tx.comment.update({
          where: { id: comment.parentId },
          data: { repliesCount: { decrement: 1 } }
        });
      }

      return updated;
    });

    await logCommentAction(actorId, 'DELETE', commentId, comment.videoId, { reason, actorId });
    return result;
  }

  static async pinComment(actorUserId: string, commentId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { videoId: true, parentId: true, status: true }
    });

    if (!comment) throw new Error("Comment not found");
    if (comment.parentId) throw new Error("Cannot pin replies");
    if (comment.status === 'DELETED' || comment.status === 'HIDDEN') {
      throw new Error("Cannot pin deleted or hidden comments");
    }

    return await prisma.$transaction(async (tx) => {
      // Unpin any previous pinned comment for this video
      await tx.comment.updateMany({
        where: { videoId: comment.videoId, pinnedAt: { not: null } },
        data: { pinnedAt: null, pinnedById: null }
      });

      const updated = await tx.comment.update({
        where: { id: commentId },
        data: {
          pinnedAt: new Date(),
          pinnedById: actorUserId
        }
      });

      await logCommentAction(actorUserId, 'PIN', commentId, updated.videoId);
      return updated;
    });
  }

  static async unpinComment(actorUserId: string, commentId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { videoId: true, pinnedAt: true }
    });

    if (!comment) throw new Error("Comment not found");
    if (!comment.pinnedAt) return null;

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        pinnedAt: null,
        pinnedById: null
      }
    });

    await logCommentAction(actorUserId, 'UNPIN', commentId, updated.videoId);
    return updated;
  }
}
