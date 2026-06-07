import { prisma } from '@/lib/prisma';
import { CommentReactionType } from '@prisma/client';

export class CommentReactionService {
  static async toggleLike(userId: string, commentId: string) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.commentReaction.findUnique({
        where: { userId_commentId: { userId, commentId } }
      });

      if (existing) {
        await tx.commentReaction.delete({ where: { id: existing.id } });
        await tx.comment.update({
          where: { id: commentId },
          data: { likesCount: { decrement: 1 } }
        });
        return { liked: false };
      } else {
        await tx.commentReaction.create({
          data: { userId, commentId, type: CommentReactionType.LIKE }
        });
        await tx.comment.update({
          where: { id: commentId },
          data: { likesCount: { increment: 1 } }
        });
        return { liked: true };
      }
    });
  }
}
