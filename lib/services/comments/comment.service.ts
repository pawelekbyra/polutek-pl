import { prisma } from '@/lib/prisma';
import { Prisma, CommentStatus, CommentDeletedReason } from '@prisma/client';
import { isUuid } from '@/lib/utils/uuid';
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
    limit: number = 20,
    forceOnlyVisible: boolean = false
  ): Promise<{ comments: CommentDto[], totalCount: number, nextCursor: string | null }> {

    // If videoId is not a UUID, we must first resolve it to an ID via slug
    let resolvedVideoId = videoId;
    if (!isUuid(videoId)) {
        const video = await prisma.video.findUnique({ where: { slug: videoId }, select: { id: true } });
        if (!video) return { comments: [], totalCount: 0, nextCursor: null };
        resolvedVideoId = video.id;
    }

    const [video, canModerateReal] = await Promise.all([
      prisma.video.findUnique({ where: { id: resolvedVideoId }, select: { creator: { select: { userId: true } } } }),
      CommentAccessService.canModerate(userId, resolvedVideoId)
    ]);

    const canModerate = canModerateReal;
    const videoCreatorId = video?.creator?.userId || null;

    const where: Prisma.CommentWhereInput = {
      videoId: resolvedVideoId,
      parentId: null,
      status: canModerate ? undefined : CommentStatus.VISIBLE
    };

    const totalCount = await prisma.comment.count({
      where: {
        videoId: resolvedVideoId,
        parentId: null,
        status: canModerate ? undefined : CommentStatus.VISIBLE
      }
    });

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

    const commentSelect = {
        id: true,
        text: true,
        imageUrl: true,
        authorId: true,
        videoId: true,
        parentId: true,
        status: true,
        likesCount: true,
        repliesCount: true,
        reportsCount: true,
        pinnedAt: true,
        editedAt: true,
        deletedAt: true,
        deletedReason: true,
        createdAt: true,
        updatedAt: true,
    };

    const comments = await prisma.comment.findMany({
      where,
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy,
      select: {
        ...commentSelect,
        author: { select: publicCommentAuthorSelect },
        replies: {
          where: canModerate ? undefined : { status: CommentStatus.VISIBLE },
          take: 3,
          orderBy: { createdAt: 'asc' },
          select: {
            ...commentSelect,
            author: { select: publicCommentAuthorSelect },
            reactions: userId ? { where: { userId } } : undefined
          }
        },
        reactions: userId ? { where: { userId } } : undefined
      }
    });

    const context = { userId, canModerate, videoCreatorId };
    const mappedComments: CommentDto[] = comments.map(c => this.mapToDto(c, context));

    return {
      comments: mappedComments,
      totalCount,
      nextCursor: comments.length === limit ? comments[limit - 1].id : null
    };
  }

  static mapToDto(comment: any, context: { userId: string | null, canModerate: boolean, videoCreatorId: string | null }): CommentDto {
    const { userId, canModerate, videoCreatorId } = context;
    const isDeleted = comment.status === CommentStatus.DELETED;
    const isHidden = comment.status === CommentStatus.HIDDEN;

    // Non-moderators don't see hidden comments or text of deleted ones
    const shouldHideContent = (isHidden && !canModerate) || (isDeleted && !canModerate);
    const author = (isDeleted && !canModerate) ? null : toPublicCommentAuthor(comment.author, videoCreatorId);

    return {
      id: comment.id,
      videoId: comment.videoId,
      parentId: comment.parentId,
      text: shouldHideContent ? null : comment.text,
      imageUrl: shouldHideContent ? null : comment.imageUrl,
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
      reportsCount: canModerate ? comment.reportsCount : undefined,
      viewerReaction: comment.reactions?.[0]?.type || null,
      viewerCanEdit: userId === comment.authorId && !isDeleted && !isHidden,
      viewerCanDelete: (userId === comment.authorId && !isDeleted) || canModerate,
      viewerCanReport: !!userId && userId !== comment.authorId && !isDeleted && !isHidden,
      viewerCanModerate: canModerate,
      viewerCanPin: canModerate && !comment.parentId,
      isPinned: !!comment.pinnedAt,
      isHearted: (comment as any).isHearted || false,
      repliesPreview: comment.replies?.map((r: any) => this.mapToDto(r, context)) || []
    };
  }

  static async createComment(userId: string, videoId: string, text: string, parentId?: string, imageUrl?: string) {
    let finalParentId = parentId || null;

    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, parentId: true, videoId: true }
      });
      if (!parent || parent.videoId !== videoId) throw new Error("Invalid parent comment");

      // Enforce one-level nesting: if parent is a reply, attach to its parent instead
      if (parent.parentId) {
        finalParentId = parent.parentId;
      }
    }

    return await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          authorId: userId,
          videoId,
          text,
          parentId: finalParentId,
          imageUrl,
          status: CommentStatus.VISIBLE
        },
        select: {
            ...commentSelect,
            author: { select: publicCommentAuthorSelect }
        }
      });

      if (finalParentId) {
        await tx.comment.update({
          where: { id: finalParentId },
          data: { repliesCount: { increment: 1 } }
        });
      }

      await logCommentAction(userId, 'CREATE', comment.id, videoId, { parentId: finalParentId });

      return comment;
    });
  }

  static async updateComment(userId: string, commentId: string, text: string) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== userId) throw new Error("Unauthorized");

    // Issue 3: Prevent editing deleted or hidden comments
    if (comment.status !== CommentStatus.VISIBLE) {
        throw new Error("Cannot edit moderated or deleted comments");
    }

    return await prisma.comment.update({
      where: { id: commentId },
      data: {
        text,
        editedAt: new Date()
      },
      select: commentSelect
    });
  }

  static async pinComment(commentId: string, moderatorId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { videoId: true, parentId: true }
    });

    if (!comment) throw new Error("Comment not found");
    if (comment.parentId) throw new Error("Cannot pin replies");

    return await prisma.$transaction(async (tx) => {
      // Unpin any existing pinned comment for this video
      await tx.comment.updateMany({
        where: { videoId: comment.videoId, pinnedAt: { not: null } },
        data: { pinnedAt: null, pinnedById: null }
      });

      // Pin the new comment
      const updated = await tx.comment.update({
        where: { id: commentId },
        data: {
          pinnedAt: new Date(),
          pinnedById: moderatorId
        },
        select: commentSelect
      });

      await logCommentAction(moderatorId, 'PIN', commentId, comment.videoId);
      return updated;
    });
  }

  static async unpinComment(commentId: string) {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        pinnedAt: null,
        pinnedById: null
      },
      select: commentSelect
    });

    await logCommentAction(comment.pinnedById || 'system', 'UNPIN', commentId, comment.videoId);
    return comment;
  }

  static async toggleHeart(commentId: string, moderatorId: string) {
    // Note: isHearted might be missing in DB. Using try-catch and avoiding direct column access if possible.
    try {
        const comment = await prisma.comment.findUnique({
          where: { id: commentId },
          select: {
              videoId: true,
              // We use a safe check here or omit it if we want to be fully resilient to missing column
          }
        });

        if (!comment) throw new Error("Comment not found");

        // If the column is missing in DB, this will fail.
        // For now, we'll try to use raw query or just catch the error if we want to support it gracefully.
        const currentIsHearted = await prisma.$queryRaw<any[]>`SELECT "isHearted" FROM "Comment" WHERE id = ${commentId}`;
        const nextValue = !(currentIsHearted[0]?.isHearted);

        await prisma.$executeRaw`UPDATE "Comment" SET "isHearted" = ${nextValue} WHERE id = ${commentId}`;

        await logCommentAction(moderatorId, nextValue ? 'HEART' : 'UNHEART', commentId, comment.videoId);
        return { ...comment, isHearted: nextValue };
    } catch (err: any) {
        logger.error("[CommentService.toggleHeart] Failed:", err.message);
        throw new Error("Funkcja 'serduszka' jest obecnie niedostępna.");
    }
  }
}
