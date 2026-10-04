import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";

/** How long the text of a comment its author deleted is kept before it is erased (owner decision 2026-10-04). */
export const AUTHOR_DELETED_COMMENT_RETENTION_DAYS = 30;

/**
 * Daily retention job: erases the text of comments deleted by their authors more than
 * `AUTHOR_DELETED_COMMENT_RETENTION_DAYS` ago. Moderation-deleted or hidden comments keep their text.
 */
export async function purgeAuthorDeletedComments(ctx: AppContext): Promise<UseCaseResult<{ purged: number; deletedBefore: string }, CommentError>> {
  if (ctx.actor.type !== "system") return fail({ type: "UNAUTHORIZED", message: "Tylko zadanie systemowe." });
  const deletedBefore = new Date(ctx.now().getTime() - AUTHOR_DELETED_COMMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const purged = await new CommentRepository(ctx.prisma).purgeAuthorDeletedContent(deletedBefore);
    return ok({ purged, deletedBefore: deletedBefore.toISOString() });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_PURGE_ERROR", error));
  }
}
