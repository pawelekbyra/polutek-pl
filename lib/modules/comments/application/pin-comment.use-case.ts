import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { CommentStatus } from "@prisma/client";
import { authorizeComments } from "./authorize-comments";

export interface PinCommentInput {
  commentId: string;
}

/** Pins a top-level comment; any other pinned comment of the same video is unpinned (one per video). */
export async function pinComment(
  input: PinCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<void, CommentError>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  // Only the channel's own people pin (owner, manager, moderator); platform staff use the admin panel.
  if (actor.type !== 'user') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany." });
  }

  const repo = new CommentRepository(prisma);

  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

    // Role matrix (CLAUDE.md 4.23): owner, manager and moderator of the video's channel, and platform staff.
    const denied = await authorizeComments(ctx, "comment.pin", [commentId]);
    if (denied) return fail(denied);

    if (comment.parentId) {
      return fail({ type: "VALIDATION_ERROR", message: "Tylko komentarze główne mogą być przypięte." });
    }
    if (comment.status !== CommentStatus.VISIBLE) {
      return fail({ type: "CONFLICT", message: "Tylko widoczne komentarze mogą być przypięte." });
    }

    await ctx.db.writeTransaction((tx: WriteTx) => new CommentRepository(tx).pin(commentId, comment.videoId));

    await recordAuditEventSafe(ctx, {
      action: "COMMENT_PIN",
      targetType: "COMMENT",
      targetId: commentId,
      metadata: { videoId: comment.videoId }
    });

    return ok(undefined);
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_PIN_ERROR", error));
  }
}
