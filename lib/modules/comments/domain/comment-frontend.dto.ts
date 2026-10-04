/**
 * The one definition of the comment wire format (public and admin APIs, client cache).
 * Client-safe on purpose: no Prisma imports, so client components can use it directly.
 * The server maps database rows to these types in `comment.dto.ts`.
 */
export type CommentStatusDto = 'VISIBLE' | 'HELD_FOR_REVIEW' | 'HIDDEN' | 'DELETED';

export type CommentDeletedReasonDto = 'AUTHOR_DELETED' | 'MODERATOR_DELETED' | 'SPAM' | 'ABUSE' | 'OTHER';

export type CommentReportReasonDto = 'SPAM' | 'HARASSMENT' | 'HATE' | 'NSFW' | 'SPOILER' | 'OTHER';

export type CommentReactionDto = 'LIKE' | 'DISLIKE';

/** No supporter badge on purpose: tips never buy a public distinction (patron status is admin-only). */
export type CommentAuthorBadgeDto = 'ADMIN' | 'AUTHOR';

export type AccessTierDto = 'PUBLIC' | 'LOGGED_IN';

export type CommentAuthorDto = {
  id: string;
  displayName: string;
  username: string | null;
  imageUrl: string | null;
  badges: CommentAuthorBadgeDto[];
};

export type CommentDto = {
  id: string;
  videoId: string;
  parentId: string | null;
  /** Null whenever the viewer may not see the content (anything but VISIBLE for non-moderators). */
  text: string | null;
  status: CommentStatusDto;
  author: CommentAuthorDto | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedReason: CommentDeletedReasonDto | null;
  pinnedAt: string | null;
  likesCount: number;
  /** Replies the viewer can see (computed, not a stored counter). */
  repliesCount: number;
  reportsCount?: number;
  viewerReaction: CommentReactionDto | null;
  viewerCanEdit: boolean;
  viewerCanDelete: boolean;
  viewerCanReport: boolean;
  viewerCanModerate: boolean;
  viewerCanPin: boolean;
  isPinned: boolean;
  isHearted: boolean;
  /** The first replies of the thread; the rest is paged through `/api/comments/[id]/replies`. */
  repliesPreview: CommentDto[];
};
