import type { AppContext } from "@/lib/modules/shared/app-context";
import { authorize, type AuthzAction } from "@/lib/modules/authz";
import type { AppError } from "@/lib/modules/shared/app-error";
import type { CommentError } from "../domain/comment.errors";

/**
 * Authorization for the comment moderation use cases (CLAUDE.md 4.23): the actor must be allowed `action` in the
 * channel each comment belongs to. Platform staff and the system are decided without touching the database; a user
 * (the channel owner in the Studio) needs the comment's video's channel, which is loaded here.
 */

function toCommentError(denied: AppError): CommentError {
  if (denied.statusCode === 404) return { type: "NOT_FOUND", message: denied.message };
  return { type: "UNAUTHORIZED", message: denied.message };
}

/** Returns an error when the actor may not do `action` on one of `commentIds` (comments that do not exist are left to the caller). */
export async function authorizeComments(ctx: AppContext, action: AuthzAction, commentIds: string[]): Promise<CommentError | null> {
  if (ctx.actor.type !== "user") {
    const denied = await authorize(ctx, action);
    return denied ? toCommentError(denied) : null;
  }
  if (commentIds.length === 0) return null;

  const rows = await ctx.prisma.comment.findMany({
    where: { id: { in: commentIds } },
    select: { id: true, video: { select: { creatorId: true, creator: { select: { userId: true, status: true } } } } },
  });
  const checked = new Set<string>();
  for (const row of rows) {
    const channel = row.video?.creator;
    if (!row.video || !channel) return { type: "UNAUTHORIZED", message: "Komentarz nie należy do żadnego kanału." };
    // One decision per channel is enough: the comments of one channel share it.
    if (checked.has(row.video.creatorId)) continue;
    checked.add(row.video.creatorId);
    const denied = await authorize(ctx, action, {
      channel: { id: row.video.creatorId, ownerUserId: channel.userId, status: channel.status },
    });
    if (denied) return toCommentError(denied);
  }
  return null;
}

/** Same for a report: the report's comment decides the channel. A missing report is left to the caller. */
export async function authorizeReport(ctx: AppContext, action: AuthzAction, reportId: string): Promise<CommentError | null> {
  if (ctx.actor.type !== "user") return authorizeComments(ctx, action, []);
  const report = await ctx.prisma.commentReport.findUnique({ where: { id: reportId }, select: { commentId: true } });
  return report ? authorizeComments(ctx, action, [report.commentId]) : null;
}

/**
 * For list use cases: staff may list across channels; a user may list only the channel the context names
 * (`ctx.channelId`) and only when allowed `action` there. Returns the channel to filter by (or null = all) or an error.
 */
export async function scopeToChannel(
  ctx: AppContext,
  action: AuthzAction,
  requestedChannelId?: string | null,
): Promise<{ channelId: string | null } | { error: CommentError }> {
  if (ctx.actor.type !== "user") {
    const denied = await authorize(ctx, action);
    if (denied) return { error: toCommentError(denied) };
    return { channelId: requestedChannelId ?? ctx.channelId ?? null };
  }
  const channelId = requestedChannelId ?? ctx.channelId ?? null;
  if (!channelId) return { error: { type: "UNAUTHORIZED", message: "Wybierz kanał, aby zobaczyć komentarze." } };
  const denied = await authorize(ctx, action, { channelId });
  if (denied) return { error: toCommentError(denied) };
  return { channelId };
}

/** Who to record as the moderator: the account (site user or panel account), or the system job's reason. */
export function moderatorId(ctx: AppContext): string {
  const actor = ctx.actor;
  if (actor.type === "user" || actor.type === "admin") return actor.userId;
  if (actor.type === "system") return `system:${actor.reason}`;
  return "unknown";
}
