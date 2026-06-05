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
  authorId?: string;
  authorName?: string;
  imageUrl?: string | null;
  author?: CommentAuthorView | null;
  text: string;
  createdAt?: string | Date;
  isLiked?: boolean;
  isDisliked?: boolean;
  _count?: CommentCounts;
  replies?: CommentView[];
  canPin?: boolean;
  isPinned?: boolean;
  pinnedAt?: string | Date | null;
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
