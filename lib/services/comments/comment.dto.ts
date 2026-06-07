export type CommentStatusDto = 'VISIBLE' | 'HELD_FOR_REVIEW' | 'HIDDEN' | 'DELETED';

export type CommentDeletedReasonDto = 'AUTHOR_DELETED' | 'MODERATOR_DELETED' | 'SPAM' | 'ABUSE' | 'OTHER';

export type CommentReportReasonDto = 'SPAM' | 'HARASSMENT' | 'HATE' | 'NSFW' | 'SPOILER' | 'OTHER';

export type CommentReactionDto = 'LIKE';

export type CommentAuthorBadgeDto = 'ADMIN' | 'PATRON' | 'AUTHOR';

export type AccessTierDto = 'PUBLIC' | 'LOGGED_IN' | 'PATRON';

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
  text: string | null;
  imageUrl: string | null;
  status: CommentStatusDto;
  author: CommentAuthorDto | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedReason: CommentDeletedReasonDto | null;
  pinnedAt: string | null;
  likesCount: number;
  repliesCount: number;
  reportsCount?: number;
  score?: number;
  viewerReaction: CommentReactionDto | null;
  viewerCanEdit: boolean;
  viewerCanDelete: boolean;
  viewerCanReport: boolean;
  viewerCanModerate: boolean;
  viewerCanPin: boolean;
  isPinned: boolean;
  repliesPreview: CommentDto[];
};

export type CommentListResponse = {
  comments: CommentDto[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  viewer: {
    canComment: boolean;
    canReact: boolean;
    canReport: boolean;
    canModerate: boolean;
  };
};
