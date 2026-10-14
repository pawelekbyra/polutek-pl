import { CommentDeletedReason, CommentReportReason, CommentReportStatus, CommentStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { toPublicCommentAuthor } from "@/lib/comments-public-author";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { scopeToChannel } from "./authorize-comments";
import { MODERATION_QUEUE_WHERE, PanelCommentRepository, panelCommentWhere, type PanelCommentFilters, type PanelCommentRecord } from "../infrastructure/panel-comment.repository";

/** A comment as the admin panel lists it. Plain data (ISO dates), safe to hand to client components. */
export type PanelComment = {
  id: string;
  /** Null when the author deleted it themselves (that content is never shown again, not even to admins). */
  text: string | null;
  status: CommentStatus;
  deletedReason: CommentDeletedReason | null;
  createdAt: string;
  parentId: string | null;
  video: { id: string; title: string; slug: string } | null;
  author: { id: string; name: string; isDeleted: boolean; isAdmin: boolean; commentsCount: number; mutedUntil: string | null } | null;
  likesCount: number;
  repliesCount: number;
  reportsCount: number;
  isHearted: boolean;
  creatorReplied: boolean;
  isQuestion: boolean;
  pendingReports: { id: string; reason: CommentReportReason; note: string | null; createdAt: string; reporter: string }[];
};

export type PanelPage<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };


function clampPage(page?: number, pageSize?: number, fallback = 25) {
  return { page: Math.max(1, Math.floor(page || 1)), pageSize: Math.max(1, Math.min(100, Math.floor(pageSize || fallback))) };
}

export function toPanelComment(c: PanelCommentRecord, now: Date): PanelComment {
  const authorDeleted = c.deletedReason === CommentDeletedReason.AUTHOR_DELETED;
  const author = c.author ? toPublicCommentAuthor(c.author) : null;
  const mutedUntil = c.author?.commentMutedUntil && c.author.commentMutedUntil > now ? c.author.commentMutedUntil.toISOString() : null;
  return {
    id: c.id,
    text: authorDeleted ? null : c.text,
    status: c.status,
    deletedReason: c.deletedReason,
    createdAt: c.createdAt.toISOString(),
    parentId: c.parentId,
    video: c.video,
    author: c.author && author ? { id: c.author.id, name: author.displayName, isDeleted: c.author.isDeleted, isAdmin: c.author.role === "ADMIN", commentsCount: c.author._count.comments, mutedUntil } : null,
    likesCount: Math.max(0, c.likesCount),
    repliesCount: c._count.replies,
    reportsCount: c.reportsCount,
    isHearted: c.isHearted,
    creatorReplied: c.replies.length > 0,
    isQuestion: c.parentId === null && c.text.includes("?"),
    pendingReports: c.reports.map((r) => ({ id: r.id, reason: r.reason, note: r.note, createdAt: r.createdAt.toISOString(), reporter: r.reporter?.isDeleted ? "usunięte konto" : r.reporter?.name || "bez pseudonimu" })),
  };
}

/** Comments with filters (text/author, status, film, author, unanswered questions, reported); newest first. */
export async function listPanelComments(ctx: AppContext, input: PanelCommentFilters & { page?: number; pageSize?: number }): Promise<UseCaseResult<PanelPage<PanelComment>, CommentError>> {
  const scope = await scopeToChannel(ctx, "comment.moderate", input.channelId);
  if ("error" in scope) return fail(scope.error);
  const { page, pageSize } = clampPage(input.page, input.pageSize);
  try {
    const where = panelCommentWhere({ ...input, channelId: scope.channelId ?? undefined });
    const { items, total } = await new PanelCommentRepository(ctx.prisma).list(where, page, pageSize, "newest");
    const now = ctx.now();
    return ok({ items: items.map((c) => toPanelComment(c, now)), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_PANEL_LIST_ERROR", error));
  }
}

/** The moderation queue: held comments and comments with pending reports, oldest first (triage order). */
export async function listModerationQueue(ctx: AppContext, input: { page?: number; pageSize?: number; channelId?: string } = {}): Promise<UseCaseResult<PanelPage<PanelComment>, CommentError>> {
  const scope = await scopeToChannel(ctx, "comment.moderate", input.channelId);
  if ("error" in scope) return fail(scope.error);
  const { page, pageSize } = clampPage(input.page, input.pageSize);
  try {
    const where = scope.channelId ? { AND: [MODERATION_QUEUE_WHERE, { video: { creatorId: scope.channelId } }] } : MODERATION_QUEUE_WHERE;
    const { items, total } = await new PanelCommentRepository(ctx.prisma).list(where, page, pageSize, "oldest");
    const now = ctx.now();
    return ok({ items: items.map((c) => toPanelComment(c, now)), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_QUEUE_LIST_ERROR", error));
  }
}

export type ResolvedReportRow = { id: string; status: CommentReportStatus; reason: CommentReportReason; resolvedAt: string | null; reporter: string; comment: { id: string; text: string | null; status: CommentStatus; author: string; videoTitle: string; videoSlug: string } };

/** History of closed reports (upheld or dismissed), newest decision first. */
export async function listResolvedReports(ctx: AppContext, input: { page?: number; pageSize?: number; channelId?: string } = {}): Promise<UseCaseResult<PanelPage<ResolvedReportRow>, CommentError>> {
  const scope = await scopeToChannel(ctx, "comment.moderate", input.channelId);
  if ("error" in scope) return fail(scope.error);
  const { page, pageSize } = clampPage(input.page, input.pageSize);
  try {
    const { items, total } = await new PanelCommentRepository(ctx.prisma).resolvedReports(page, pageSize, scope.channelId);
    return ok({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      items: items.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.reason,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        reporter: r.reporter?.isDeleted ? "usunięte konto" : r.reporter?.name || "bez pseudonimu",
        comment: {
          id: r.comment.id,
          text: r.comment.deletedReason === CommentDeletedReason.AUTHOR_DELETED ? null : r.comment.text,
          status: r.comment.status,
          author: r.comment.author?.isDeleted ? "usunięte konto" : r.comment.author?.name || "bez pseudonimu",
          videoTitle: r.comment.video?.title ?? "—",
          videoSlug: r.comment.video?.slug ?? "",
        },
      })),
    });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_RESOLVED_REPORTS_ERROR", error));
  }
}

/** Counters for the tab badges: comments in the queue, held, pending reports. */
export async function getModerationCounts(ctx: AppContext, input: { channelId?: string } = {}): Promise<UseCaseResult<{ comments: number; held: number; pendingReports: number }, CommentError>> {
  const scope = await scopeToChannel(ctx, "comment.moderate", input.channelId);
  if ("error" in scope) return fail(scope.error);
  try {
    return ok(await new PanelCommentRepository(ctx.prisma).queueCounts(scope.channelId));
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_QUEUE_COUNTS_ERROR", error));
  }
}
