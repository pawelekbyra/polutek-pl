import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentDeletedReason } from "@prisma/client";

/** Deletes a comment as a moderator. Final: the content stays stored as evidence but is never shown publicly again. */
export async function deleteAdminComment(input: { commentId: string, reason?: CommentDeletedReason }, ctx: AppContext): Promise<UseCaseResult<void, CommentError>> {
  if (ctx.actor.type !== 'admin') return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });
  const actorId = ctx.actor.userId;
  const { commentId, reason = 'MODERATOR_DELETED' } = input;
  try {
    const comment = await new CommentRepository(ctx.prisma).findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const deleted = await new CommentRepository(tx).softDelete(commentId, { deletedAt: ctx.now(), deletedById: actorId, deletedReason: reason });
      if (deleted) {
        await recordAuditEvent(ctx, { action: "COMMENT_DELETE", targetType: "COMMENT", targetId: commentId, metadata: { reason, from: comment.status } }, tx);
      }
    });
    return ok(undefined);
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_ADMIN_DELETE_ERROR", error));
  }
}
