import { CommentStatus } from "@prisma/client";
import { toPublicCommentAuthor, publicCommentAuthorSelect } from "@/lib/comments-public-author";

export interface CommentAuthorDto {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  role: string;
  isPatron: boolean;
  isAuthor?: boolean;
}

export interface CommentDto {
  id: string;
  videoId: string;
  parentId: string | null;
  text: string | null;
  imageUrl: string | null;
  status: CommentStatus;
  author: CommentAuthorDto | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedReason: string | null;
  pinnedAt: string | null;
  likesCount: number;
  repliesCount: number;
  reportsCount?: number;
  viewerReaction: string | null;
  viewerCanEdit: boolean;
  viewerCanDelete: boolean;
  viewerCanReport: boolean;
  viewerCanModerate: boolean;
  viewerCanPin: boolean;
  isPinned: boolean;
  isHearted: boolean;
  repliesPreview: CommentDto[];
}

export interface CommentInteractionDto {
  liked: boolean;
  disliked: boolean;
}

export function mapCommentToDto(
    comment: any,
    context: {
        userId: string | null,
        canModerate: boolean,
        videoCreatorId: string | null,
        hasVideoAccess?: boolean
    }
): CommentDto {
    const { userId, canModerate, videoCreatorId, hasVideoAccess = true } = context;
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
      viewerCanEdit: userId === comment.authorId && !isDeleted && !isHidden && hasVideoAccess,
      viewerCanDelete: ((userId === comment.authorId && !isDeleted) || canModerate) && hasVideoAccess,
      viewerCanReport: !!userId && userId !== comment.authorId && !isDeleted && !isHidden && hasVideoAccess,
      viewerCanModerate: canModerate && hasVideoAccess,
      viewerCanPin: canModerate && !comment.parentId && hasVideoAccess,
      isPinned: !!comment.pinnedAt,
      isHearted: (comment as any).isHearted || false,
      repliesPreview: comment.replies?.map((r: any) => mapCommentToDto(r, context)) || []
    };
}
