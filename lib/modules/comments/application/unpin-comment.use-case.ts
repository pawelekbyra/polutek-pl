import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEventSafe } from "@/lib/modules/audit";

export interface UnpinCommentInput {
  commentId: string;
}

export async function unpinComment(
  input: UnpinCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<void, CommentError>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany." });
  }

  const userId = actor.userId;
  const repo = new CommentRepository(prisma);

  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

    const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
    const canUnpin = actor.type === 'admin' || videoCreatorId === userId;
    if (!canUnpin) return fail({ type: "FORBIDDEN", message: "Brak uprawnień do odpięcia komentarza." });

    if (!comment.pinnedAt) return ok(undefined);
    await repo.unpin(commentId);

    await recordAuditEventSafe(ctx, {
      action: "COMMENT_UNPIN",
      targetType: "COMMENT",
      targetId: commentId,
      metadata: { videoId: comment.videoId }
    });

    return ok(undefined);
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_UNPIN_ERROR", error));
  }
}
