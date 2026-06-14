import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentStatus, CommentDeletedReason } from "@prisma/client";

export interface DeleteCommentInput {
  commentId: string;
}

export async function deleteComment(
  input: DeleteCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<void, CommentError>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby usunąć komentarz." });
  }

  const userId = actor.userId;
  const repo = new CommentRepository(prisma);

  const comment = await repo.findCommentById(commentId);
  if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

  // 0. Access Check (inheritance)
  const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  // Inheritance: to delete you must have access to the video
  // (Exception: Global Admin bypass is usually handled by checkVideoAccess or policy)
  if (!accessResult.data.hasAccess) {
    return fail({
        type: "FORBIDDEN",
        message: accessResult.data.reason === "PATRON_REQUIRED"
            ? "Ten film jest dostępny tylko dla Patronów."
            : "Brak dostępu."
    });
  }

  const isAuthor = comment.authorId === userId;

  // 1. Authorization check
  const isGlobalAdmin = actor.type === 'admin';
  const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
  const isVideoOwner = userId !== null && videoCreatorId === userId;
  const isModerator = isGlobalAdmin || isVideoOwner;

  if (!CommentPolicy.canDeleteComment(actor, comment.authorId, isModerator)) {
    return fail({ type: "FORBIDDEN", message: "Nie masz uprawnień do usunięcia tego komentarza." });
  }

  // Already deleted
  if (comment.status === CommentStatus.DELETED) {
      return ok(undefined);
  }

  const reason: CommentDeletedReason = isAuthor ? 'AUTHOR_DELETED' : 'MODERATOR_DELETED';

  try {
    await repo.softDelete(commentId, {
      status: CommentStatus.DELETED,
      deletedAt: new Date(),
      deletedById: userId,
      deletedReason: reason
    });

    await recordAuditEvent(ctx, {
        action: "COMMENT_DELETE",
        targetType: "COMMENT",
        targetId: commentId,
        metadata: { reason, deletedBy: userId }
    });

    return ok(undefined);
  } catch (error:
any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
