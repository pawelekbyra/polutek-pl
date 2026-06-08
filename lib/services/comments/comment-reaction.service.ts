import { prisma } from '@/lib/prisma';
import { CommentReactionType } from '@prisma/client';

export class CommentReactionService {
  static async like(userId: string, commentId: string) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.commentReaction.findUnique({
        where: { userId_commentId: { userId, commentId } }
      });

      if (existing) {
        return { liked: true };
      }

      await tx.commentReaction.create({
        data: { userId, commentId, type: CommentReactionType.LIKE }
      });

      await tx.comment.update({
        where: { id: commentId },
        data: {
          likesCount: { increment: 1 },
          score: { increment: 1 }
        }
      });

      return { liked: true };
    });
  }

  static async unlike(userId: string, commentId: string) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.commentReaction.findUnique({
        where: { userId_commentId: { userId, commentId } }
      });

      if (!existing) {
        return { liked: false };
      }

      await tx.commentReaction.delete({ where: { id: existing.id } });

      const comment = await tx.comment.findUnique({
          where: { id: commentId },
          select: { likesCount: true, score: true }
      });

      if (comment) {
          await tx.comment.update({
            where: { id: commentId },
            data: {
                likesCount: { decrement: 1 },
                score: { decrement: 1 }
            }
          });

          // Double check to avoid underflow
          await tx.comment.updateMany({
              where: { id: commentId, likesCount: { lt: 0 } },
              data: { likesCount: 0, score: 0 }
          });
      }

      return { liked: false };
    });
  }

  static async getViewerReaction(userId: string | null, commentId: string) {
    if (!userId) return null;
    const reaction = await prisma.commentReaction.findUnique({
      where: { userId_commentId: { userId, commentId } },
      select: { type: true }
    });
    return reaction?.type || null;
  }

  static async toggleLike(userId: string, commentId: string) {
    const existing = await this.getViewerReaction(userId, commentId);
    if (existing === CommentReactionType.LIKE) {
      return this.unlike(userId, commentId);
    } else {
      return this.like(userId, commentId);
    }
  }
}
