import type { CommentAuthorDto, CommentDto } from "@/lib/modules/comments/domain/comment-frontend.dto";

/** A comment as the API returns it (the single DTO definition lives in comment-frontend.dto.ts). */
export type CommentView = CommentDto;

export type CommentBadgeKind = "AUTHOR" | "VIP";

/**
 * The one badge shown under an author's avatar. "AUTHOR" (the video's creator) outranks "VIP" (an active PAID
 * patron-zone access): a creator who also holds a pass shows only "Twórca", so the column never grows a second pill.
 * Tips and donations never produce a badge, and being an admin is a role, not a badge.
 */
export function getAuthorBadge(author?: CommentAuthorDto | null): CommentBadgeKind | null {
  if (!author) return null;
  if (author.badges.includes("AUTHOR")) return "AUTHOR";
  return author.badges.includes("VIP") ? "VIP" : null;
}
