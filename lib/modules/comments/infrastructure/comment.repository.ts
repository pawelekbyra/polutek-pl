import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { Prisma } from "@prisma/client";

export class CommentRepository {
  static async findById(db: ReadDb, id: string) {
    return db.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, role: true, isPatron: true, imageUrl: true }
        }
      }
    });
  }

  static async listByVideoId(db: ReadDb, videoId: string, userId?: string) {
    return db.comment.findMany({
      where: {
        videoId,
        parentId: null, // Top-level comments
        status: { in: ['VISIBLE', 'HELD_FOR_REVIEW'] } // Adjusted for public list
      },
      include: {
        author: {
          select: { id: true, name: true, role: true, isPatron: true, imageUrl: true }
        },
        _count: {
          select: { reactions: true, replies: true }
        },
        reactions: userId ? {
            where: { userId }
        } : false
      },
      orderBy: [
        { pinnedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  static async create(tx: WriteTx, data: Prisma.CommentCreateInput) {
    return tx.comment.create({
      data,
      include: {
        author: {
          select: { id: true, name: true, role: true, isPatron: true, imageUrl: true }
        }
      }
    });
  }

  static async update(tx: WriteTx, id: string, data: Prisma.CommentUpdateInput) {
    return tx.comment.update({
      where: { id },
      data,
      include: {
        author: {
          select: { id: true, name: true, role: true, isPatron: true, imageUrl: true }
        }
      }
    });
  }

  static async delete(tx: WriteTx, id: string) {
    return tx.comment.delete({
      where: { id }
    });
  }

  static async findReaction(db: ReadDb, commentId: string, userId: string) {
    return db.commentReaction.findUnique({
      where: {
        userId_commentId: { userId, commentId }
      }
    });
  }

  static async createReaction(tx: WriteTx, commentId: string, userId: string) {
    return tx.commentReaction.create({
      data: { commentId, userId }
    });
  }

  static async deleteReaction(tx: WriteTx, commentId: string, userId: string) {
    return tx.commentReaction.delete({
      where: {
        userId_commentId: { userId, commentId }
      }
    });
  }
}
