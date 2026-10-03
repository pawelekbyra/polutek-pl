import type { CommentAuthorDto, CommentDto } from "@/lib/modules/comments/domain/comment-frontend.dto";

/** A comment as the API returns it (the single DTO definition lives in comment-frontend.dto.ts). */
export type CommentView = CommentDto;

export type CommentBadgeKind = "AUTHOR" | "PATRON";

/**
 * The badge shown next to an author's name: "AUTHOR" for the video's creator, otherwise "PATRON"
 * for supporters. Being an admin is a role, not a badge, so it never shows as "PATRON".
 */
export function getAuthorBadge(author?: CommentAuthorDto | null): CommentBadgeKind | null {
  if (!author) return null;
  if (author.badges.includes("AUTHOR")) return "AUTHOR";
  if (author.badges.includes("PATRON")) return "PATRON";
  return null;
}
