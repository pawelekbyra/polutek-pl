import { CommentStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { authorizeComments } from "./authorize-comments";

/**
 * Sets the creator's heart to an explicit state (idempotent, unlike `toggleAdminCommentHeart`, which flips and so
 * double-fires on a repeated request). No change means no write and no audit row.
 */
export async function setAdminCommentHeart(ctx: AppContext, input: { commentId: string; hearted: boolean }): Promise<UseCaseResult<{ isHearted: boolean; changed: boolean }, CommentError>> {
  const denied = await authorizeComments(ctx, "comment.heart", [input.commentId]);
  if (denied) return fail(denied);
  try {
    const comment = await new CommentRepository(ctx.prisma).findCommentById(input.commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    if (comment.status === CommentStatus.DELETED) return fail({ type: "CONFLICT", message: "Usuniętemu komentarzowi nie można dać serduszka." });
    if (comment.isHearted === input.hearted) return ok({ isHearted: input.hearted, changed: false });
    await ctx.db.writeTransaction(async (tx: WriteTx) => {
      await new CommentRepository(tx).setHeart(input.commentId, input.hearted);
      await recordAuditEvent(ctx, { action: input.hearted ? "COMMENT_HEART" : "COMMENT_UNHEART", targetType: "COMMENT", targetId: input.commentId }, tx);
    });
    return ok({ isHearted: input.hearted, changed: true });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_HEART_ERROR", error));
  }
}
