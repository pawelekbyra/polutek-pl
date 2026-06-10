import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentStatus } from "@prisma/client";

export interface PinCommentInput {
  commentId: string;
}

export async function pinComment(
  input: PinCommentInput,
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

  if (comment.parentId) {
    return fail({ type: "VALIDATION_ERROR", message: "Tylko komentarze główne mogą być przypięte." });
  }

  if (comment.status !== CommentStatus.VISIBLE) {
    return fail({ type: "VALIDATION_ERROR", message: "Tylko widoczne komentarze mogą być przypięte." });
  }

  const userId = actor.type === 'admin' || actor.type === 'user' ? actor.userId : null;
  const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
  const canPin = actor.type === 'admin' || (userId !== null && videoCreatorId === userId);

  if (!canPin) {
    return fail({ type: "FORBIDDEN", message: "Brak uprawnień do przypięcia komentarza." });
  }

  try {
    await repo.pin(commentId);

    await recordAuditEvent(ctx, {
      action: "COMMENT_PIN",
      targetType: "COMMENT",
      targetId: commentId,
      metadata: { videoId: comment.videoId }
    });

    return ok(undefined);
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
