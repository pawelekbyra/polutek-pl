import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";

export interface UnpinCommentInput {
  commentId: string;
}

export async function unpinComment(
  input: UnpinCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<void, CommentError>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany." });
  }

  const repo = new CommentRepository(prisma);
  const comment = await repo.findCommentById(commentId);

  if (!comment) {
    return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
  }

  const userId = actor.type === 'admin' || actor.type === 'user' ? actor.userId : null;
  const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
  const canUnpin = actor.type === 'admin' || (userId !== null && videoCreatorId === userId);

  if (!canUnpin) {
    return fail({ type: "FORBIDDEN", message: "Brak uprawnień do odpięcia komentarza." });
  }

  try {
    await repo.unpin(commentId);

    await recordAuditEvent(ctx, {
      action: "COMMENT_UNPIN",
      targetType: "COMMENT",
      targetId: commentId,
      metadata: { videoId: comment.videoId }
    });

    return ok(undefined);
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
