import { AppContext } from "@/lib/modules/shared/app-context";
import { canModerateVideoComments } from "./authorize-comments";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, CommentDtoContext, canSeeCommentContent, mapCommentToDto } from "../domain/comment.dto";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";

export const MAX_REPLIES_PAGE_SIZE = 50;

export interface ListCommentRepliesInput {
  commentId: string;
  cursor?: string;
  limit: number;
}

const NOT_FOUND: CommentError = { type: "NOT_FOUND", message: "Komentarz nie istnieje." };

/**
 * All replies of a thread, oldest first, in pages. Readable by everyone, guests included, like
 * the comment list itself; a thread whose root the viewer may not see is NOT_FOUND.
 */
export async function listCommentReplies(
  input: ListCommentRepliesInput,
  ctx: AppContext
): Promise<UseCaseResult<{ replies: CommentDto[], nextCursor: string | null }, CommentError>> {
  const { commentId, cursor } = input;
  const limit = Math.min(Math.max(1, Math.trunc(input.limit) || 1), MAX_REPLIES_PAGE_SIZE);
  const { actor, prisma } = ctx;
  const repo = new CommentRepository(prisma);

  try {
    const parentComment = await repo.findCommentById(commentId);
    if (!parentComment) return fail(NOT_FOUND);

    const accessResult = await checkVideoAccess({ videoIdOrSlug: parentComment.videoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("COMMENT_REPLIES_ACCESS_ERROR", accessResult.error));

    // Comments are publicly readable even on login-required videos; only a missing or
    // deleted video blocks reading. Writes are restricted by the viewer permissions.
    if (!accessResult.data.hasAccess) {
      const reason = accessResult.data.reason;
      if (reason === 'NOT_FOUND' || reason === 'DELETED') {
        return fail({ type: "NOT_FOUND", message: "Film nie istnieje lub został usunięty." });
      }
    }

    const userId = actor.type === 'user' || actor.type === 'admin' ? actor.userId : null;
    const videoCreatorId = await repo.findVideoCreatorId(parentComment.videoId);
    const canModerate = await canModerateVideoComments(ctx, parentComment.videoId);
    const context: CommentDtoContext = { userId, canModerate, videoCreatorId, hasVideoAccess: accessResult.data.hasAccess };

    if (!canSeeCommentContent(parentComment, context) || parentComment.author?.isDeleted) return fail(NOT_FOUND);

    const rows = await repo.findReplies(commentId, userId, canModerate, cursor, limit + 1);
    const page = rows.slice(0, limit);

    return ok({
      replies: page.map((reply) => mapCommentToDto(reply, context)),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_REPLIES_ERROR", error));
  }
}
