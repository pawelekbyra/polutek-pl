import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { VideoLike, VideoDislike, CommentReaction, CommentReactionType, CommentStatus, CommentDeletedReason, Comment, CommentReportStatus, Prisma, PrismaClient } from "@prisma/client";
import { publicCommentAuthorSelect } from "@/lib/comments-public-author";

export interface ListCommentsOptions {
  videoId: string;
  userId?: string | null;
  sortBy: 'newest' | 'top' | 'oldest';
  cursor?: string;
  limit: number;
  includeHidden?: boolean;
}

export interface CreateCommentInput {
  authorId: string;
  videoId: string;
  creatorId: string;
  text: string;
  parentId?: string | null;
  imageUrl?: string | null;
}

const visibleCommentStatusFilter = (includeHidden?: boolean) =>
  includeHidden ? { not: CommentStatus.DELETED } : CommentStatus.VISIBLE;

export const commentInclude = (userId?: string | null, includeHidden?: boolean) => ({
  author: { select: publicCommentAuthorSelect },
  replies: {
    where: { status: visibleCommentStatusFilter(includeHidden) },
    take: 3,
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: publicCommentAuthorSelect },
      reactions: userId ? { where: { userId } } : false
    }
  },
  reactions: userId ? { where: { userId } } : false
});

export class CommentRepository {
  constructor(private db: ReadDb) {}

  async findVideoLike(userId: string, videoId: string): Promise<VideoLike | null> {
    return await this.db.videoLike.findUnique({ where: { userId_videoId: { userId, videoId } } });
  }
  async findVideoDislike(userId: string, videoId: string): Promise<VideoDislike | null> {
    return await this.db.videoDislike.findUnique({ where: { userId_videoId: { userId, videoId } } });
  }
  async createVideoLike(userId: string, videoId: string): Promise<VideoLike> {
    const like = await (this.db as WriteTx).videoLike.create({ data: { userId, videoId } });
    await (this.db as WriteTx).video.update({ where: { id: videoId }, data: { likesCount: { increment: 1 } } });
    return like;
  }
  async deleteVideoLike(id: string, videoId: string): Promise<void> {
    await (this.db as WriteTx).videoLike.delete({ where: { id } });
    await (this.db as WriteTx).video.updateMany({ where: { id: videoId, likesCount: { gt: 0 } }, data: { likesCount: { decrement: 1 } } });
  }
  async createVideoDislike(userId: string, videoId: string): Promise<VideoDislike> {
    const dislike = await (this.db as WriteTx).videoDislike.create({ data: { userId, videoId } });
    await (this.db as WriteTx).video.update({ where: { id: videoId }, data: { dislikesCount: { increment: 1 } } });
    return dislike;
  }
  async deleteVideoDislike(id: string, videoId: string): Promise<void> {
    await (this.db as WriteTx).videoDislike.delete({ where: { id } });
    await (this.db as WriteTx).video.updateMany({ where: { id: videoId, dislikesCount: { gt: 0 } }, data: { dislikesCount: { decrement: 1 } } });
  }
  async getVideoReactionSnapshot(userId: string, videoId: string) {
    const [like, dislike, video] = await Promise.all([
      this.findVideoLike(userId, videoId),
      this.findVideoDislike(userId, videoId),
      this.db.video.findUnique?.({
        where: { id: videoId },
        select: { likesCount: true, dislikesCount: true },
      }) ?? Promise.resolve(null),
    ]);
    return {
      liked: !!like,
      disliked: !!dislike,
      likesCount: Math.max(0, video?.likesCount ?? 0),
      dislikesCount: Math.max(0, video?.dislikesCount ?? 0),
    };
  }
  async findCommentById(id: string) {
    return await this.db.comment.findUnique({ where: { id }, include: { author: { select: publicCommentAuthorSelect } } });
  }
  async findAdminComments(options: { q?: string; status?: CommentStatus; videoId?: string; limit: number }) {
    const { q, status, videoId, limit } = options;
    return await this.db.comment.findMany({ where: { AND: [ q ? { text: { contains: q, mode: 'insensitive' } } : {}, status ? { status } : {}, videoId ? { videoId } : {} ] }, take: limit, orderBy: { createdAt: 'desc' }, include: { author: { select: publicCommentAuthorSelect } } });
  }
  async findCommentReaction(userId: string, commentId: string): Promise<CommentReaction | null> {
    return await this.db.commentReaction.findUnique({ where: { userId_commentId: { userId, commentId } } });
  }
  async createCommentLike(userId: string, commentId: string): Promise<CommentReaction> {
    const reaction = await (this.db as WriteTx).commentReaction.create({ data: { userId, commentId, type: "LIKE" } });
    await (this.db as WriteTx).comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 }, score: { increment: 1 } } });
    return reaction;
  }
  async deleteCommentReaction(id: string, commentId: string): Promise<void> {
    await (this.db as WriteTx).commentReaction.delete({ where: { id } });
    await (this.db as WriteTx).comment.update({ where: { id: commentId }, data: { likesCount: { decrement: 1 }, score: { increment: -1 } } });
    await (this.db as WriteTx).comment.updateMany({ where: { id: commentId, likesCount: { lt: 0 } }, data: { likesCount: 0, score: 0 } });
  }
  async getCommentReactionSnapshot(userId: string, commentId: string) {
    const [reaction, comment] = await Promise.all([
      this.findCommentReaction(userId, commentId),
      this.db.comment.findUnique({
        where: { id: commentId },
        select: { likesCount: true },
      }),
    ]);
    return {
      liked: reaction?.type === "LIKE",
      likesCount: Math.max(0, comment?.likesCount ?? 0),
    };
  }
  async findMany(options: ListCommentsOptions) {
    const { videoId, userId, sortBy, cursor, limit, includeHidden } = options;
    const where: Prisma.CommentWhereInput = { videoId, parentId: null, status: visibleCommentStatusFilter(includeHidden) };
    const orderBy: Prisma.CommentOrderByWithRelationInput[] = [];
    if (sortBy === 'top') { orderBy.push({ pinnedAt: { sort: 'desc', nulls: 'last' } }); orderBy.push({ likesCount: 'desc' }); orderBy.push({ createdAt: 'desc' }); }
    else if (sortBy === 'oldest') { orderBy.push({ pinnedAt: { sort: 'desc', nulls: 'last' } }); orderBy.push({ createdAt: 'asc' }); }
    else { orderBy.push({ pinnedAt: { sort: 'desc', nulls: 'last' } }); orderBy.push({ createdAt: 'desc' }); }
    return await this.db.comment.findMany({ where, take: limit, skip: cursor ? 1 : 0, cursor: cursor ? { id: cursor } : undefined, orderBy, include: commentInclude(userId, includeHidden) });
  }
  async findReplies(parentId: string, userId: string | null, includeHidden: boolean, cursor?: string, limit: number = 10) {
    return await this.db.comment.findMany({ where: { parentId, status: visibleCommentStatusFilter(includeHidden) }, take: limit, skip: cursor ? 1 : 0, cursor: cursor ? { id: cursor } : undefined, orderBy: { createdAt: 'asc' }, include: { author: { select: publicCommentAuthorSelect }, reactions: userId ? { where: { userId } } : false } });
  }
  async count(options: Partial<ListCommentsOptions>) {
    const { videoId, includeHidden } = options;
    return await this.db.comment.count({ where: { videoId, parentId: null, status: visibleCommentStatusFilter(includeHidden) } });
  }
  async create(input: CreateCommentInput): Promise<Comment> {
    const { authorId, videoId, creatorId, text, parentId, imageUrl } = input;
    return await (this.db as WriteTx).comment.create({ data: { authorId, videoId, creatorId, text, parentId, imageUrl, status: CommentStatus.VISIBLE } });
  }
  async incrementRepliesCount(commentId: string): Promise<void> {
    await (this.db as WriteTx).comment.update({ where: { id: commentId }, data: { repliesCount: { increment: 1 } } });
  }
  async update(id: string, data: { text: string; editedAt: Date }): Promise<Comment> {
    return await (this.db as WriteTx).comment.update({ where: { id }, data });
  }
  async findVideoByCommentId(commentId: string) {
    const comment = await this.db.comment.findUnique({ where: { id: commentId }, select: { videoId: true } });
    if (!comment) return null;
    return await this.db.video.findUnique({ where: { id: comment.videoId }, select: { creator: { select: { userId: true } } } });
  }
  async findVideoCreatorId(videoId: string): Promise<string | null> {
    const video = await this.db.video.findUnique({ where: { id: videoId }, select: { creator: { select: { userId: true } } } });
    return video?.creator?.userId || null;
  }
  async pin(commentId: string): Promise<void> {
    await (this.db as WriteTx).comment.update({ where: { id: commentId }, data: { pinnedAt: new Date() } });
  }
  async unpin(commentId: string): Promise<void> {
    await (this.db as WriteTx).comment.update({ where: { id: commentId }, data: { pinnedAt: null } });
  }
  async softDelete(id: string, data: { status: CommentStatus; deletedAt: Date; deletedById: string; deletedReason: CommentDeletedReason }) {
    const { status, deletedAt, deletedById, deletedReason } = data;
    const comment = await this.db.comment.findUnique({ where: { id }, select: { parentId: true } });
    const writeDb = this.db as unknown as PrismaClient;
    return await writeDb.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.comment.update({ where: { id }, data: { status, deletedAt, deletedById, deletedReason, text: "[deleted]", imageUrl: null } });
      if (comment?.parentId) { await tx.comment.update({ where: { id: comment.parentId }, data: { repliesCount: { decrement: 1 } } }); }
      return updated;
    });
  }
  async updateCommentStatus(id: string, data: { status: CommentStatus; moderatedAt: Date | null; moderatedById: string | null }) {
    return await (this.db as WriteTx).comment.update({ where: { id }, data });
  }
  async toggleHeart(id: string): Promise<{ isHearted: boolean }> {
    const comment = await this.db.comment.findUnique({ where: { id }, select: { isHearted: true } as any });
    const nextValue = !(comment as any)?.isHearted;
    await (this.db as WriteTx).$executeRaw`UPDATE "Comment" SET "isHearted" = ${nextValue} WHERE id = ${id}`;
    return { isHearted: nextValue };
  }
  async findReports(status?: CommentReportStatus) {
    return await this.db.commentReport.findMany({ where: status ? { status } : {}, include: { comment: { include: { author: { select: publicCommentAuthorSelect }, video: { select: { id: true, title: true, slug: true } } } }, reporter: { select: publicCommentAuthorSelect } }, orderBy: { createdAt: 'desc' } });
  }
  async findReportById(id: string) {
    return await this.db.commentReport.findUnique({ where: { id }, include: { comment: true } });
  }
  async resolveReport(id: string, data: { status: CommentReportStatus; resolvedAt: Date; resolvedById: string }) {
    return await (this.db as WriteTx).commentReport.update({ where: { id }, data });
  }
}

/**
 * R10 Cleanup Note:
 * Phase 1 (Admin Moderation) is complete.
 * R7 Certification Reconcile is complete.
 * Phase 2 (Dead Services) has been partially executed;
 * some services were retained for test stability.
 */
