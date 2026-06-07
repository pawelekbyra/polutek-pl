import { prisma } from '@/lib/prisma';
import { Prisma, CommentStatus, CommentDeletedReason } from '@prisma/client';
import { toPublicCommentAuthor, publicCommentAuthorSelect } from '@/lib/comments-public-author';
import { logCommentAction } from './comment-audit.service';
import { CommentDto } from './comment.dto';
import { CommentAccessService } from './comment-access.service';
import { CommentAuthorDto } from './comment.dto';

export class CommentService {
  static async getComments(
    videoId: string,
    userId: string | null,
    sortBy: 'newest' | 'top' | 'oldest' = 'newest',
    cursor?: string,
    limit: number = 20
  ): Promise<{ comments: CommentDto[], totalCount: number, nextCursor: string | null }> {

    const where: Prisma.CommentWhereInput = {
      videoId,
      parentId: null,
      status: { not: CommentStatus.HIDDEN }
    };

    const totalCount = await prisma.comment.count({ where });

    const orderBy: Prisma.CommentOrderByWithRelationInput[] = [];
    if (sortBy === 'top') {
      orderBy.push({ pinnedAt: { sort: 'desc', nulls: 'last' } });
      orderBy.push({ likesCount: 'desc' });
      orderBy.push({ createdAt: 'desc' });
    } else if (sortBy === 'oldest') {
      orderBy.push({ pinnedAt: { sort: 'desc', nulls: 'last' } });
      orderBy.push({ createdAt: 'asc' });
    } else {
      orderBy.push({ pinnedAt: { sort: 'desc', nulls: 'last' } });
      orderBy.push({ createdAt: 'desc' });
    }

    const comments = await prisma.comment.findMany({
      where,
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy,
      include: {
        author: { select: publicCommentAuthorSelect },
        replies: {
          where: { status: { not: CommentStatus.HIDDEN } },
          take: 3,
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: publicCommentAuthorSelect }
          }
        },
        reactions: userId ? { where: { userId } } : false
      }
    });

    const mappedComments: CommentDto[] = comments.map(c => this.mapToDto(c, userId));

    return {
      comments: mappedComments,
      totalCount,
      nextCursor: comments.length === limit ? comments[limit - 1].id : null
    };
  }

  static mapToDto(comment: any, userId: string | null): CommentDto {
    const isDeleted = comment.status === CommentStatus.DELETED;
    const author = isDeleted ? null : toPublicCommentAuthor(comment.author);

    return {
      id: comment.id,
      videoId: comment.videoId,
      parentId: comment.parentId,
      text: isDeleted ? null : comment.text,
      imageUrl: isDeleted ? null : comment.imageUrl,
      status: comment.status,
      author: author as CommentAuthorDto | null,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      editedAt: comment.editedAt?.toISOString() || null,
      deletedAt: comment.deletedAt?.toISOString() || null,
      deletedReason: comment.deletedReason,
      pinnedAt: comment.pinnedAt?.toISOString() || null,
      likesCount: comment.likesCount,
      repliesCount: comment.repliesCount,
      reportsCount: comment.reportsCount,
      viewerReaction: comment.reactions?.[0]?.type || null,
      viewerCanEdit: userId === comment.authorId && !isDeleted,
      viewerCanDelete: userId === comment.authorId && !isDeleted,
      viewerCanReport: !!userId && userId !== comment.authorId,
      viewerCanModerate: false, // Set this based on permissions elsewhere if needed
      repliesPreview: comment.replies?.map((r: any) => this.mapToDto(r, userId)) || []
    };
  }

  static async createComment(userId: string, videoId: string, text: string, parentId?: string, imageUrl?: string) {
    return await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          authorId: userId,
          videoId,
          text,
          parentId,
          imageUrl,
          status: CommentStatus.VISIBLE
        },
        include: {
            author: { select: publicCommentAuthorSelect }
        }
      });

      if (parentId) {
        await tx.comment.update({
          where: { id: parentId },
          data: { repliesCount: { increment: 1 } }
        });
      }

      await logCommentAction(userId, 'CREATE', comment.id, videoId, { parentId });

      return comment;
    });
  }

  static async updateComment(userId: string, commentId: string, text: string) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== userId) throw new Error("Unauthorized");

    return await prisma.comment.update({
      where: { id: commentId },
      data: {
        text,
        editedAt: new Date()
      }
    });
  }
}
