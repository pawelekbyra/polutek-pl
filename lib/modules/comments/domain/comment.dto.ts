import { AccessTier } from "@prisma/client";

export type CommentStatusDto = 'VISIBLE' | 'HELD_FOR_REVIEW' | 'HIDDEN' | 'DELETED';
export type CommentDeletedReasonDto = 'AUTHOR_DELETED' | 'MODERATOR_DELETED' | 'SPAM' | 'ABUSE' | 'OTHER';
export type CommentAuthorBadgeDto = 'ADMIN' | 'PATRON' | 'AUTHOR';
export type CommentReactionDto = 'LIKE';

export interface CommentAuthorDto {
  id: string;
  displayName: string;
  username: string | null;
  imageUrl: string | null;
  badges: CommentAuthorBadgeDto[];
}

export interface PublicCommentDto {
  id: string;
  videoId: string;
  parentId: string | null;
  text: string | null;
  imageUrl: string | null;
  status: CommentStatusDto;
  author: CommentAuthorDto | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  pinnedAt: string | null;
  likesCount: number;
  repliesCount: number;
  isPinned: boolean;
  isHearted: boolean;

  // Viewer-specific fields
  viewerReaction: CommentReactionDto | null;
  viewerCanEdit: boolean;
  viewerCanDelete: boolean;
  viewerCanReport: boolean;
  viewerCanModerate: boolean;
  viewerCanPin: boolean;

  // For replies preview
  repliesPreview?: PublicCommentDto[];
}

export interface CommentListDto {
  comments: PublicCommentDto[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  viewer: {
    canComment: boolean;
    canReact: boolean;
    canReport: boolean;
    canModerate: boolean;
  };
}
