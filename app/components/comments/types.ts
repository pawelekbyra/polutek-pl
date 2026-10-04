import type { CommentAuthorDto, CommentDto } from "@/lib/modules/comments/domain/comment-frontend.dto";

/** A comment as the API returns it (the single DTO definition lives in comment-frontend.dto.ts). */
export type CommentView = CommentDto;

export type CommentBadgeKind = "AUTHOR";

/**
 * The badge shown under an author's avatar: only the video's creator ("AUTHOR"). Supporters get
 * no public badge (a tip buys nothing), and being an admin is a role, not a badge.
 */
export function getAuthorBadge(author?: CommentAuthorDto | null): CommentBadgeKind | null {
  if (!author) return null;
  return author.badges.includes("AUTHOR") ? "AUTHOR" : null;
}
