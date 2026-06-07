"use client";

export type CommentCounts = { likes: number; dislikes: number; replies?: number };
export type CommentAuthorView = {
  imageUrl?: string | null;
  slug?: string | null;
  name?: string | null;
  username?: string | null;
  isPatron?: boolean | null;
  role?: string | null;
};

export type CommentView = {
  id: string;
  videoId?: string;
  parentId?: string | null;
  authorId?: string;
  authorName?: string;
  imageUrl?: string | null;
  author?: CommentAuthorView | null;
  text: string | null;
  status?: "VISIBLE" | "HELD_FOR_REVIEW" | "HIDDEN" | "DELETED";
  createdAt?: string | Date;
  updatedAt?: string | Date;
  editedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  deletedReason?: string | null;
  isLiked?: boolean;
  isDisliked?: boolean;
  _count?: CommentCounts;
  likesCount?: number;
  repliesCount?: number;
  reportsCount?: number;
  replies?: CommentView[];
  canPin?: boolean;
  isPinned?: boolean;
  pinnedAt?: string | Date | null;
  viewerReaction?: "LIKE" | null;
  viewerCanEdit?: boolean;
  viewerCanDelete?: boolean;
  viewerCanReport?: boolean;
  viewerCanModerate?: boolean;
};

export function getAvatarSeed(comment: CommentView) {
  return (
    comment.authorName ||
    comment.author?.username ||
    comment.authorId ||
    comment.id
  );
}

export function isPatronAuthor(author?: CommentAuthorView | null) {
  return (
    !!author &&
    (author.role === "ADMIN" || author.isPatron === true)
  );
}
