import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentStatus, CommentDeletedReason } from "@prisma/client";
export async function deleteAdminComment(input: { commentId: string, reason?: CommentDeletedReason }, ctx: AppContext): Promise<UseCaseResult<void, CommentError>> {
  if (ctx.actor.type !== 'admin') return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });
  const { commentId, reason = 'MODERATOR_DELETED' } = input;
  const repo = new CommentRepository(ctx.prisma);
  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    if (comment.status === CommentStatus.DELETED) return ok(undefined);
    await repo.softDelete(commentId, { status: CommentStatus.DELETED, deletedAt: new Date(), deletedById: ctx.actor.userId!, deletedReason: reason });
    await recordAuditEvent(ctx, { action: "COMMENT_DELETE", targetType: "COMMENT", targetId: commentId, metadata: { reason, actorId: ctx.actor.userId } });
    return ok(undefined);
  } catch (error:
any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
