import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
export async function toggleAdminCommentHeart(commentId: string, ctx: AppContext): Promise<UseCaseResult<{ isHearted: boolean }, CommentError>> {
  if (ctx.actor.type !== 'admin') return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });
  const repo = new CommentRepository(ctx.prisma);
  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    const result = await repo.toggleHeart(commentId);
    await recordAuditEvent(ctx, { action: result.isHearted ? "COMMENT_HEART" : "COMMENT_UNHEART", targetType: "COMMENT", targetId: commentId, metadata: { actorId: ctx.actor.userId } });
    return ok(result);
  } catch (error:
any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
