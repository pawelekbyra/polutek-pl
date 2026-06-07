import { CommentStatus } from '@prisma/client';

export type CommentAuthorDto = {
  id: string;
  displayName: string;
  username: string | null;
  imageUrl: string | null;
  badges: Array<"ADMIN" | "PATRON" | "AUTHOR">;
};

export type CommentDto = {
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
  viewerReaction: "LIKE" | null;
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
