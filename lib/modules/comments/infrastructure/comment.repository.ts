import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { CommentReactionType, CommentStatus, CommentDeletedReason, Comment, CommentReportReason, CommentReportStatus, Prisma } from "@prisma/client";
import { publicCommentAuthorSelect } from "@/lib/comments-public-author";
import type { ReactionTarget } from "../domain/comment.dto";

export interface ListCommentsOptions {
  videoId: string;
  userId?: string | null;
  sortBy: 'newest' | 'top';
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
  /** Defaults to VISIBLE; HELD_FOR_REVIEW puts the comment straight into the review queue. */
  status?: CommentStatus;
}

/** Replies embedded with every top-level comment; the rest is paged through `findReplies`. */
export const REPLIES_PREVIEW_LIMIT = 3;

/**
 * The one visibility rule for threads: viewers see VISIBLE comments, moderators also see
 * HIDDEN and HELD_FOR_REVIEW, nobody sees DELETED ones, and comments of deleted accounts
 * are gone for everyone (the author row is only a tombstone).
 */
export function threadCommentWhere(includeHidden?: boolean): Prisma.CommentWhereInput {
  return {
    status: includeHidden ? { not: CommentStatus.DELETED } : CommentStatus.VISIBLE,
    author: { isDeleted: false },
  };
}

export const commentReportInclude = Prisma.validator<Prisma.CommentReportInclude>()({
  comment: { include: { author: { select: publicCommentAuthorSelect }, video: { select: { id: true, title: true, slug: true } } } },
  reporter: { select: publicCommentAuthorSelect },
});

export type CommentReportWithRelations = Prisma.CommentReportGetPayload<{ include: typeof commentReportInclude }>;

const viewerReactionInclude = (userId?: string | null) =>
  userId ? { where: { userId }, select: { type: true } } : false;

/** Oldest first; `id` breaks ties so cursor pagination never repeats or skips a reply. */
const replyOrderBy: Prisma.CommentOrderByWithRelationInput[] = [{ createdAt: 'asc' }, { id: 'asc' }];

export const commentInclude = (userId?: string | null, includeHidden?: boolean) => ({
  author: { select: publicCommentAuthorSelect },
  replies: {
    where: threadCommentWhere(includeHidden),
    take: REPLIES_PREVIEW_LIMIT,
    orderBy: replyOrderBy,
    include: {
      author: { select: publicCommentAuthorSelect },
      reactions: viewerReactionInclude(userId),
    },
  },
  reactions: viewerReactionInclude(userId),
  _count: { select: { replies: { where: threadCommentWhere(includeHidden) } } },
});

/** Comment row as the DTO mapper needs it (see `mapCommentToDto`). */
export type CommentWithRelations = Prisma.CommentGetPayload<{ include: ReturnType<typeof commentInclude> }>;


export class CommentRepository {
  constructor(private db: ReadDb) {}

  private get write(): WriteTx {
    return this.db as WriteTx;
  }

  /**
   * Serialises every change of one (user, target) reaction pair for the rest of the transaction
   * (transaction-scoped advisory lock). Without it two concurrent requests of one user can each read a
   * stale "other" reaction (video LIKE and DISLIKE live in separate tables) or clear a row the other
   * request has just added, which leaves both reactions set or the counter off by one.
   */
  private async lockReactionPair(kind: "video" | "comment", userId: string, targetId: string): Promise<void> {
    await this.write.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reaction:${kind}:${userId}:${targetId}`}))`;
  }

  /**
   * Sets the viewer's reaction to a video to exactly `target` (LIKE, DISLIKE or none) and moves
   * the counters by what actually changed. Idempotent and safe under concurrent requests: the
   * insert is `ON CONFLICT DO NOTHING` and every counter delta comes from the affected row count.
   * Must run inside a transaction.
   */
  async setVideoReaction(userId: string, videoId: string, target: ReactionTarget): Promise<void> {
    await this.lockReactionPair("video", userId, videoId);
    const removedLikes = target === "LIKE" ? 0 : (await this.write.videoLike.deleteMany({ where: { userId, videoId } })).count;
    const removedDislikes = target === "DISLIKE" ? 0 : (await this.write.videoDislike.deleteMany({ where: { userId, videoId } })).count;
    const addedLikes = target === "LIKE"
      ? (await this.write.videoLike.createMany({ data: [{ userId, videoId }], skipDuplicates: true })).count
      : 0;
    const addedDislikes = target === "DISLIKE"
      ? (await this.write.videoDislike.createMany({ data: [{ userId, videoId }], skipDuplicates: true })).count
      : 0;

    const likesDelta = addedLikes - removedLikes;
    const dislikesDelta = addedDislikes - removedDislikes;
    if (likesDelta === 0 && dislikesDelta === 0) return;

    await this.write.video.update({
      where: { id: videoId },
      data: { likesCount: { increment: likesDelta }, dislikesCount: { increment: dislikesDelta } },
    });
    if (likesDelta < 0) await this.write.video.updateMany({ where: { id: videoId, likesCount: { lt: 0 } }, data: { likesCount: 0 } });
    if (dislikesDelta < 0) await this.write.video.updateMany({ where: { id: videoId, dislikesCount: { lt: 0 } }, data: { dislikesCount: 0 } });
  }

  async getVideoReactionSnapshot(userId: string, videoId: string) {
    const [like, dislike, video] = await Promise.all([
      this.db.videoLike.findUnique({ where: { userId_videoId: { userId, videoId } }, select: { id: true } }),
      this.db.videoDislike.findUnique({ where: { userId_videoId: { userId, videoId } }, select: { id: true } }),
      this.db.video.findUnique({ where: { id: videoId }, select: { likesCount: true, dislikesCount: true } }),
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

  /** One comment with everything the DTO needs (preview replies, visible reply count, viewer reaction). */
  async findCommentForDto(id: string, userId: string | null, includeHidden: boolean) {
    return await this.db.comment.findUnique({ where: { id }, include: commentInclude(userId, includeHidden) });
  }

  async findAdminComments(options: { q?: string; status?: CommentStatus; videoId?: string; page?: number; pageSize?: number }) {
    const { q, status, videoId, page = 1, pageSize = 50 } = options;
    const where: Prisma.CommentWhereInput = { AND: [ q ? { text: { contains: q, mode: 'insensitive' } } : {}, status ? { status } : {}, videoId ? { videoId } : {} ] };
    const skip = (Math.max(1, page) - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.db.comment.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' }, include: { author: { select: publicCommentAuthorSelect } } }),
      this.db.comment.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Sets the viewer's reaction to a comment to exactly `target` and moves `likesCount` by what
   * actually changed (dislikes have no public counter). Idempotent and race-safe like
   * `setVideoReaction`. Must run inside a transaction. Returns the change of `likesCount`.
   */
  async setCommentReaction(userId: string, commentId: string, target: ReactionTarget): Promise<{ likeDelta: number }> {
    await this.lockReactionPair("comment", userId, commentId);
    let likeDelta = 0;
    if (target === null) {
      likeDelta -= (await this.write.commentReaction.deleteMany({ where: { userId, commentId, type: "LIKE" } })).count;
      await this.write.commentReaction.deleteMany({ where: { userId, commentId } });
    } else {
      const other: CommentReactionType = target === "LIKE" ? "DISLIKE" : "LIKE";
      const switched = (await this.write.commentReaction.updateMany({ where: { userId, commentId, type: other }, data: { type: target } })).count;
      const inserted = switched > 0
        ? 0
        : (await this.write.commentReaction.createMany({ data: [{ userId, commentId, type: target }], skipDuplicates: true })).count;
      likeDelta = target === "LIKE" ? switched + inserted : -switched;
    }

    if (likeDelta !== 0) {
      await this.write.comment.update({ where: { id: commentId }, data: { likesCount: { increment: likeDelta } } });
      if (likeDelta < 0) await this.write.comment.updateMany({ where: { id: commentId, likesCount: { lt: 0 } }, data: { likesCount: 0 } });
    }
    return { likeDelta };
  }

  async getCommentReactionSnapshot(userId: string, commentId: string) {
    const [reaction, comment] = await Promise.all([
      this.db.commentReaction.findUnique({ where: { userId_commentId: { userId, commentId } }, select: { type: true } }),
      this.db.comment.findUnique({ where: { id: commentId }, select: { likesCount: true } }),
    ]);
    return {
      viewerReaction: reaction?.type ?? null,
      likesCount: Math.max(0, comment?.likesCount ?? 0),
    };
  }

  async findMany(options: ListCommentsOptions) {
    const { videoId, userId, sortBy, cursor, limit, includeHidden } = options;
    const where: Prisma.CommentWhereInput = { videoId, parentId: null, ...threadCommentWhere(includeHidden) };
    const orderBy: Prisma.CommentOrderByWithRelationInput[] = [{ pinnedAt: { sort: 'desc', nulls: 'last' } }];
    if (sortBy === 'top') orderBy.push({ likesCount: 'desc' });
    orderBy.push({ createdAt: 'desc' }, { id: 'desc' });
    return await this.db.comment.findMany({ where, take: limit, skip: cursor ? 1 : 0, cursor: cursor ? { id: cursor } : undefined, orderBy, include: commentInclude(userId, includeHidden) });
  }

  /** Replies of one comment, oldest first. Pass `take = limit + 1` to learn whether more exist. */
  async findReplies(parentId: string, userId: string | null, includeHidden: boolean, cursor: string | undefined, take: number) {
    return await this.db.comment.findMany({
      where: { parentId, ...threadCommentWhere(includeHidden) },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: replyOrderBy,
      include: { author: { select: publicCommentAuthorSelect }, reactions: viewerReactionInclude(userId) },
    });
  }

  async count(options: { videoId: string; includeHidden?: boolean }) {
    const { videoId, includeHidden } = options;
    return await this.db.comment.count({ where: { videoId, parentId: null, ...threadCommentWhere(includeHidden) } });
  }

  async create(input: CreateCommentInput): Promise<Comment> {
    const { authorId, videoId, creatorId, text, parentId, status = CommentStatus.VISIBLE } = input;
    return await this.write.comment.create({ data: { authorId, videoId, creatorId, text, parentId, status } });
  }

  async update(id: string, data: { text: string; editedAt: Date }): Promise<Comment> {
    return await this.write.comment.update({ where: { id }, data });
  }

  /**
   * Rewrites the author's own comment only while it is still VISIBLE, in one conditional write: a moderator who hides,
   * holds or deletes the comment between the check and the write wins. A status other than VISIBLE (the video holds new
   * text for review) also drops the pin, like every other way out of VISIBLE. Returns whether the edit was stored.
   */
  async updateTextIfVisible(id: string, authorId: string, data: { text: string; editedAt: Date; status: CommentStatus }): Promise<boolean> {
    const unpin = data.status === CommentStatus.VISIBLE ? {} : { pinnedAt: null };
    const { count } = await this.write.comment.updateMany({
      where: { id, authorId, status: CommentStatus.VISIBLE },
      data: { ...data, ...unpin },
    });
    return count > 0;
  }

  async findVideoCreatorId(videoId: string): Promise<string | null> {
    const video = await this.db.video.findUnique({ where: { id: videoId }, select: { creator: { select: { userId: true } } } });
    return video?.creator?.userId || null;
  }

  /** Pins one comment and unpins any other on the same video (one pinned comment per video). Must run inside a transaction. */
  async pin(commentId: string, videoId: string): Promise<void> {
    await this.write.comment.updateMany({
      where: { videoId, pinnedAt: { not: null }, NOT: { id: commentId } },
      data: { pinnedAt: null },
    });
    await this.write.comment.update({ where: { id: commentId }, data: { pinnedAt: new Date() } });
  }

  async unpin(commentId: string): Promise<void> {
    await this.write.comment.update({ where: { id: commentId }, data: { pinnedAt: null } });
  }

  /**
   * Marks a comment DELETED. The content stays in the database (status decides what anyone can
   * see, see `mapCommentToDto`). Conditional on the comment not being deleted yet, so two
   * concurrent deletes change it once. Returns whether this call deleted it.
   */
  async softDelete(id: string, data: { deletedAt: Date; deletedById: string; deletedReason: CommentDeletedReason }): Promise<boolean> {
    const { count } = await this.write.comment.updateMany({
      where: { id, status: { not: CommentStatus.DELETED } },
      // A deleted comment is no longer pinned (a pin only makes sense for a visible comment).
      data: { status: CommentStatus.DELETED, pinnedAt: null, ...data },
    });
    return count > 0;
  }

  /**
   * Erases the text of comments their authors deleted before `deletedBefore` (retention). The row,
   * author and thread links stay, so replies and counters keep working. Comments deleted or hidden
   * by moderation keep their text (needed for moderation and a possible restore). Returns the count.
   */
  async purgeAuthorDeletedContent(deletedBefore: Date): Promise<number> {
    const { count } = await this.write.comment.updateMany({
      where: {
        status: CommentStatus.DELETED,
        deletedReason: CommentDeletedReason.AUTHOR_DELETED,
        deletedAt: { lt: deletedBefore },
        OR: [{ text: { not: "" } }, { imageUrl: { not: null } }],
      },
      data: { text: "", imageUrl: null },
    });
    return count;
  }

  /**
   * Moves a comment to `status` only if its current status is one of `from` (the moderation
   * state machine lives in `CommentPolicy`). Returns whether the transition happened.
   */
  async transitionStatus(id: string, from: readonly CommentStatus[], data: { status: CommentStatus; moderatedAt: Date | null; moderatedById: string | null }): Promise<boolean> {
    // Leaving VISIBLE (hidden, held for review) also drops the pin.
    const unpin = data.status === CommentStatus.VISIBLE ? {} : { pinnedAt: null };
    const { count } = await this.write.comment.updateMany({ where: { id, status: { in: [...from] } }, data: { ...data, ...unpin } });
    return count > 0;
  }

  async setHeart(id: string, isHearted: boolean): Promise<void> {
    await this.write.comment.update({ where: { id }, data: { isHearted } });
  }

  /**
   * Row lock on the comment for the rest of the transaction (`SELECT ... FOR UPDATE`). Reports of one comment, and
   * the resolving of them, queue up here (audit W18): under READ COMMITTED three transactions that each insert a
   * report and count the pending ones would otherwise each see only their own row, store 1, and never reach the
   * hold threshold. After the lock the count sees every report already committed. Must run inside a transaction,
   * before the report is written.
   */
  async lockCommentForReports(commentId: string): Promise<void> {
    await this.write.$queryRaw`SELECT "id" FROM "Comment" WHERE "id" = ${commentId} FOR UPDATE`;
  }

  /** Records one report per user and comment; a repeated report is a no-op. Returns whether a new report was stored. */
  async createReport(data: { commentId: string; reporterId: string; reason: CommentReportReason; note?: string }): Promise<boolean> {
    const { count } = await this.write.commentReport.createMany({ data: [data], skipDuplicates: true });
    return count > 0;
  }

  /** Recomputes `reportsCount` as the number of pending reports, so it always matches the queue. */
  async refreshPendingReportsCount(commentId: string): Promise<number> {
    const pending = await this.write.commentReport.count({ where: { commentId, status: CommentReportStatus.PENDING } });
    await this.write.comment.update({ where: { id: commentId }, data: { reportsCount: pending } });
    return pending;
  }

  async findReports(options: { status?: CommentReportStatus; page?: number; pageSize?: number } = {}) {
    const { status, page = 1, pageSize = 20 } = options;
    const where = status ? { status } : {};
    const skip = (Math.max(1, page) - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.db.commentReport.findMany({
        where,
        include: commentReportInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.db.commentReport.count({ where }),
    ]);
    return { items, total };
  }

  async findReportById(id: string) {
    return await this.db.commentReport.findUnique({ where: { id }, select: { id: true, commentId: true } });
  }

  async resolveReport(id: string, data: { status: CommentReportStatus; resolvedAt: Date; resolvedById: string }) {
    return await this.write.commentReport.update({ where: { id }, data });
  }
}
