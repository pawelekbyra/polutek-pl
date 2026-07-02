"use client";

export type CommentAuthorDto = {
  id: string;
  displayName: string;
  username: string | null;
  imageUrl: string | null;
  badges: Array<"ADMIN" | "PATRON" | "AUTHOR">;
};

export type CommentView = {
  id: string;
  videoId: string;
  parentId: string | null;
  text: string | null;
  imageUrl: string | null;
  status: "VISIBLE" | "HELD_FOR_REVIEW" | "HIDDEN" | "DELETED";
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
  viewerReaction: "LIKE" | "DISLIKE" | null;
  viewerCanEdit: boolean;
  viewerCanDelete: boolean;
  viewerCanReport: boolean;
  viewerCanModerate: boolean;
  viewerCanPin: boolean;
  isPinned: boolean;
  isHearted?: boolean;
  repliesPreview: CommentView[];
};

export function getAvatarSeed(comment: CommentView) {
  return (
    comment.author?.displayName ||
    comment.author?.username ||
    comment.author?.id ||
    comment.id
  );
}

export function isPatronAuthor(author?: CommentAuthorDto | null) {
  return (
    !!author &&
    author.badges.some(b => b === "ADMIN" || b === "PATRON")
  );
}
