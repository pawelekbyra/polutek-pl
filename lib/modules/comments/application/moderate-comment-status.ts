import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy, ModerationAction } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentStatus } from "@prisma/client";
import { authorizeComments, moderatorId } from "./authorize-comments";

export type StatusModerationAction = Exclude<ModerationAction, "delete">;

const TARGET_STATUS: Record<StatusModerationAction, CommentStatus> = {
  hide: CommentStatus.HIDDEN,
  hold: CommentStatus.HELD_FOR_REVIEW,
  approve: CommentStatus.VISIBLE,
  restore: CommentStatus.VISIBLE,
};

const AUDIT_ACTION: Record<StatusModerationAction, string> = {
  hide: "COMMENT_HIDE",
  hold: "COMMENT_HOLD",
  approve: "COMMENT_APPROVE",
  restore: "COMMENT_RESTORE",
};

const CONFLICT_MESSAGE: Record<StatusModerationAction, string> = {
  hide: "Usuniętego komentarza nie można ukryć.",
  hold: "Wstrzymać można tylko widoczny komentarz.",
  approve: "Zatwierdzić można tylko komentarz wstrzymany do przeglądu.",
  restore: "Przywrócić można tylko komentarz ukryty lub wstrzymany przez moderację. Usuniętego komentarza nie da się przywrócić.",
};

/**
 * Applies one admin moderation action following the state machine in `CommentPolicy`.
 * Repeating an action that already took effect is a no-op; an action the current status
 * does not allow is a CONFLICT. The status change and its audit event commit together.
 */
export async function moderateCommentStatus(
  commentId: string,
  action: StatusModerationAction,
  ctx: AppContext,
): Promise<UseCaseResult<void, CommentError>> {
  const denied = await authorizeComments(ctx, "comment.moderate", [commentId]);
  if (denied) return fail(denied);
  const actorId = moderatorId(ctx);
  const target = TARGET_STATUS[action];

  try {
    const comment = await new CommentRepository(ctx.prisma).findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    if (comment.status === target) return ok(undefined);
    if (!CommentPolicy.canTransition(action, comment.status)) {
      return fail({ type: "CONFLICT", message: CONFLICT_MESSAGE[action] });
    }

    const changed = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const moved = await new CommentRepository(tx).transitionStatus(commentId, CommentPolicy.moderationSources(action), {
        status: target,
        moderatedAt: ctx.now(),
        moderatedById: actorId,
      });
      if (moved) {
        await recordAuditEvent(
          ctx,
          { action: AUDIT_ACTION[action], targetType: "COMMENT", targetId: commentId, metadata: { from: comment.status, to: target } },
          tx,
        );
      }
      return moved;
    });
    // Someone changed the status between the read and the write.
    if (!changed) return fail({ type: "CONFLICT", message: CONFLICT_MESSAGE[action] });
    return ok(undefined);
  } catch (error) {
    return fail(commentDatabaseError(`COMMENT_${action.toUpperCase()}_ERROR`, error));
  }
}
