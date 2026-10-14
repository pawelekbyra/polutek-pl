import { CommentStatus, Prisma } from "@prisma/client";
import { ReadDb } from "@/lib/modules/shared/db";
import { publicCommentAuthorSelect } from "@/lib/comments-public-author";

/** What the panel shows about a comment's author: the public fields plus the mute and the author's comment count. */
const panelAuthorSelect = Prisma.validator<Prisma.UserSelect>()({
  ...publicCommentAuthorSelect,
  commentMutedUntil: true,
  _count: { select: { comments: true } },
});

const panelCommentInclude = Prisma.validator<Prisma.CommentInclude>()({
  author: { select: panelAuthorSelect },
  video: { select: { id: true, title: true, slug: true } },
  // A reply written by the owner of a channel counts as the creator's answer.
  replies: { where: { author: { creators: { some: {} } }, status: { not: CommentStatus.DELETED } }, select: { id: true }, take: 1 },
  _count: { select: { replies: { where: { status: { not: CommentStatus.DELETED } } } } },
  reports: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 10, include: { reporter: { select: { id: true, name: true, isDeleted: true } } } },
});

export type PanelCommentRecord = Prisma.CommentGetPayload<{ include: typeof panelCommentInclude }>;

export type PanelCommentFilters = {
  q?: string;
  status?: CommentStatus;
  videoId?: string;
  authorId?: string;
  /** Top-level, visible comments with a question mark that the creator has not answered yet. */
  unansweredQuestions?: boolean;
  /** Only comments under the videos of this channel (the Studio always sets it; staff may leave it out). */
  channelId?: string;
  /** Only comments with at least one pending report. */
  reported?: boolean;
};

export function panelCommentWhere(f: PanelCommentFilters): Prisma.CommentWhereInput {
  const and: Prisma.CommentWhereInput[] = [];
  if (f.q) and.push({ OR: [{ text: { contains: f.q, mode: "insensitive" } }, { author: { name: { contains: f.q, mode: "insensitive" } } }] });
  if (f.status) and.push({ status: f.status });
  if (f.videoId) and.push({ videoId: f.videoId });
  if (f.channelId) and.push({ video: { creatorId: f.channelId } });
  if (f.authorId) and.push({ authorId: f.authorId });
  if (f.reported) and.push({ reports: { some: { status: "PENDING" } } });
  if (f.unansweredQuestions) {
    and.push({ parentId: null, status: CommentStatus.VISIBLE, text: { contains: "?" }, author: { isDeleted: false }, replies: { none: { author: { creators: { some: {} } }, status: { not: CommentStatus.DELETED } } } });
  }
  return and.length ? { AND: and } : {};
}

/** Comments that need a decision: held for review, or with at least one pending report (whatever their status). */
export const MODERATION_QUEUE_WHERE: Prisma.CommentWhereInput = { OR: [{ status: CommentStatus.HELD_FOR_REVIEW }, { reports: { some: { status: "PENDING" } } }] };

export class PanelCommentRepository {
  constructor(private db: ReadDb) {}

  async list(where: Prisma.CommentWhereInput, page: number, pageSize: number, order: "newest" | "oldest") {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.db.comment.findMany({ where, orderBy: [{ createdAt: order === "oldest" ? "asc" : "desc" }, { id: "asc" }], skip, take: pageSize, include: panelCommentInclude }),
      this.db.comment.count({ where }),
    ]);
    return { items, total };
  }

  queueCounts(channelId?: string | null) {
    const inChannel: Prisma.CommentWhereInput = channelId ? { video: { creatorId: channelId } } : {};
    return Promise.all([
      this.db.comment.count({ where: { AND: [MODERATION_QUEUE_WHERE, inChannel] } }),
      this.db.comment.count({ where: { status: CommentStatus.HELD_FOR_REVIEW, ...inChannel } }),
      this.db.commentReport.count({ where: { status: "PENDING", ...(channelId ? { comment: { video: { creatorId: channelId } } } : {}) } }),
    ]).then(([comments, held, pendingReports]) => ({ comments, held, pendingReports }));
  }

  async resolvedReports(page: number, pageSize: number, channelId?: string | null) {
    const where: Prisma.CommentReportWhereInput = {
      status: { not: "PENDING" },
      ...(channelId ? { comment: { video: { creatorId: channelId } } } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.commentReport.findMany({
        where,
        orderBy: { resolvedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { reporter: { select: { name: true, isDeleted: true } }, comment: { select: { id: true, text: true, status: true, deletedReason: true, author: { select: { id: true, name: true, isDeleted: true } }, video: { select: { title: true, slug: true } } } } },
      }),
      this.db.commentReport.count({ where }),
    ]);
    return { items, total };
  }
}
