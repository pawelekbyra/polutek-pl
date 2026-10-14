import { AppContext } from "@/lib/modules/shared/app-context";
import { canModerateVideoComments } from "./authorize-comments";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { CommentDeletedReason } from "@prisma/client";

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

  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

    // Comments inherit the video's access rules.
    const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("COMMENT_DELETE_ACCESS_ERROR", accessResult.error));
    if (!accessResult.data.hasAccess) return fail({ type: "FORBIDDEN", message: "Brak dostępu." });

    const isAuthor = comment.authorId === userId;
    const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
    const isModerator = await canModerateVideoComments(ctx, comment.videoId);

    if (!CommentPolicy.canDeleteComment(actor, comment.authorId, isModerator)) {
      return fail({ type: "FORBIDDEN", message: "Nie masz uprawnień do usunięcia tego komentarza." });
    }

    const reason: CommentDeletedReason = isAuthor ? 'AUTHOR_DELETED' : 'MODERATOR_DELETED';
    // Conditional update: deleting an already deleted comment (double click, second tab) is a no-op.
    const deleted = await repo.softDelete(commentId, { deletedAt: ctx.now(), deletedById: userId, deletedReason: reason });

    if (deleted) {
      await recordAuditEventSafe(ctx, {
        action: "COMMENT_DELETE",
        targetType: "COMMENT",
        targetId: commentId,
        metadata: { reason },
      });
    }

    return ok(undefined);
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_DELETE_ERROR", error));
  }
}
