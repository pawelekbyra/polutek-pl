import type { CommentAuthorDto, CommentDto } from "@/lib/modules/comments/domain/comment-frontend.dto";

/** A comment as the API returns it (the single DTO definition lives in comment-frontend.dto.ts). */
export type CommentView = CommentDto;

export type CommentBadgeKind = "AUTHOR" | "VIP" | "BASE";

/**
 * The one badge shown under an author's avatar, most important first: "AUTHOR" (the video's creator) > "VIP" (an active PAID
 * patron-zone access) > "BASE" ("Normik": everyone else with an account). Only one pill ever shows, so the column never grows.
 * Tips and donations never produce a badge, and being an admin is a role, not a badge.
 */
export function getAuthorBadge(author?: CommentAuthorDto | null): CommentBadgeKind | null {
  if (!author) return null;
  if (author.badges.includes("AUTHOR")) return "AUTHOR";
  if (author.badges.includes("VIP")) return "VIP";
  return author.badges.includes("BASE") ? "BASE" : null;
}
