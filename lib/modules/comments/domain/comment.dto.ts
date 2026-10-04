import { CommentDeletedReason, CommentReactionType, CommentStatus } from "@prisma/client";
import { toPublicCommentAuthor, PublicCommentAuthor } from "@/lib/comments-public-author";
import type { CommentDto } from "./comment-frontend.dto";

export type {
  CommentDto,
  CommentAuthorDto,
  CommentAuthorBadgeDto,
  CommentStatusDto,
  CommentReactionDto,
  CommentReportReasonDto,
  CommentDeletedReasonDto,
} from "./comment-frontend.dto";

/** The reaction a viewer wants to end up with; null means none. */
export type ReactionTarget = CommentReactionType | null;

export interface CommentInteractionDto {
  liked: boolean;
  disliked: boolean;
  likesCount: number;
  dislikesCount: number;
}

/** The fields of a comment row the mapper reads; relations are optional (not every query loads them). */
export interface CommentRow {
  id: string;
  videoId: string;
  parentId: string | null;
  authorId: string;
  text: string;
  status: CommentStatus;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedReason: CommentDeletedReason | null;
  pinnedAt: Date | null;
  likesCount: number;
  reportsCount: number;
  isHearted: boolean;
  author?: PublicCommentAuthor | null;
  reactions?: Array<{ type: CommentReactionType }> | false;
  replies?: CommentRow[];
  _count?: { replies?: number };
}

export interface CommentDtoContext {
  userId: string | null;
  /** Admin, or the creator of the comment's video. */
  canModerate: boolean;
  videoCreatorId: string | null;
  hasVideoAccess?: boolean;
  /**
   * Admin panel only: show the content of comments deleted by moderation (kept as evidence).
   * Content a user deleted themselves is never shown again, not even to admins.
   */
  revealDeletedContent?: boolean;
}

/**
 * Whether the viewer may see a comment's content and author. Whitelist: everyone sees VISIBLE,
 * moderators also see HIDDEN/HELD (to review them), deleted content is admin-panel only.
 */
export function canSeeCommentContent(
  comment: Pick<CommentRow, "status" | "deletedReason">,
  context: Pick<CommentDtoContext, "canModerate" | "revealDeletedContent">,
): boolean {
  if (comment.status === CommentStatus.VISIBLE) return true;
  if (!context.canModerate) return false;
  if (comment.status === CommentStatus.DELETED) {
    return context.revealDeletedContent === true && comment.deletedReason !== CommentDeletedReason.AUTHOR_DELETED;
  }
  return true;
}

export function mapCommentToDto(comment: CommentRow, context: CommentDtoContext): CommentDto {
  const { userId, canModerate, videoCreatorId, hasVideoAccess = true } = context;
  const isVisible = comment.status === CommentStatus.VISIBLE;
  const isDeleted = comment.status === CommentStatus.DELETED;
  const showContent = canSeeCommentContent(comment, context);
  const isAuthor = userId !== null && userId === comment.authorId;
  const reactions = comment.reactions || [];

  return {
    id: comment.id,
    videoId: comment.videoId,
    parentId: comment.parentId,
    text: showContent ? comment.text : null,
    status: comment.status,
    author: showContent || canModerate ? toPublicCommentAuthor(comment.author, videoCreatorId) : null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() || null,
    deletedAt: comment.deletedAt?.toISOString() || null,
    deletedReason: comment.deletedReason,
    pinnedAt: comment.pinnedAt?.toISOString() || null,
    likesCount: Math.max(0, comment.likesCount),
    repliesCount: comment._count?.replies ?? 0,
    reportsCount: canModerate ? comment.reportsCount : undefined,
    viewerReaction: reactions[0]?.type ?? null,
    viewerCanEdit: isAuthor && isVisible && hasVideoAccess,
    viewerCanDelete: !isDeleted && (isAuthor || canModerate) && hasVideoAccess,
    viewerCanReport: userId !== null && !isAuthor && isVisible && hasVideoAccess,
    viewerCanModerate: canModerate && hasVideoAccess,
    viewerCanPin: canModerate && !comment.parentId && isVisible && hasVideoAccess,
    isPinned: !!comment.pinnedAt,
    isHearted: comment.isHearted === true,
    repliesPreview: (comment.replies || []).map((reply) => mapCommentToDto(reply, context)),
  };
}
