import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentStatus } from "@prisma/client";
export async function restoreAdminComment(commentId: string, ctx: AppContext): Promise<UseCaseResult<void, CommentError>> {
  if (ctx.actor.type !== 'admin') return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });
  const repo = new CommentRepository(ctx.prisma);
  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    await repo.updateCommentStatus(commentId, { status: CommentStatus.VISIBLE, moderatedAt: null, moderatedById: null });
    await recordAuditEvent(ctx, { action: "COMMENT_RESTORE", targetType: "COMMENT", targetId: commentId, metadata: { actorId: ctx.actor.userId } });
    return ok(undefined);
  } catch (error:
any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
