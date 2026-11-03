import { pickRoleBadge, type RoleBadgeKind } from "@/lib/role-badge";
import type { CommentAuthorDto, CommentDto } from "@/lib/modules/comments/domain/comment-frontend.dto";

/** A comment as the API returns it (the single DTO definition lives in comment-frontend.dto.ts). */
export type CommentView = CommentDto;

export type CommentBadgeKind = RoleBadgeKind;

/**
 * The one badge shown under an author's avatar, most important first: "AUTHOR" (the video's creator) > "VIP" (an active PAID
 * patron-zone access) > "BASE" ("Normik": everyone else with an account). Only one pill ever shows, so the column never grows.
 * Tips and donations never produce a badge, and being an admin is a role, not a badge.
 */
export function getAuthorBadge(author?: CommentAuthorDto | null): CommentBadgeKind | null {
  if (!author) return null;
  // The precedence is shared with the top bar (lib/role-badge.ts).
  return pickRoleBadge({ isCreator: author.badges.includes("AUTHOR"), isVip: author.badges.includes("VIP"), isBase: author.badges.includes("BASE") });
}
