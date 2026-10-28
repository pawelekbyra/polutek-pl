import { AppContext } from "@/lib/modules/shared/app-context";
import { canModerateVideoComments } from "./authorize-comments";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, CommentDtoContext, canSeeCommentContent, mapCommentToDto } from "../domain/comment.dto";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";

export interface GetCommentContextInput {
  commentId: string;
}

export interface GetCommentContextResult {
  comment: CommentDto;
  parentComment: CommentDto | null;
  videoId: string;
  canView: boolean;
}

const NOT_FOUND: CommentError = { type: "NOT_FOUND", message: "Komentarz nie istnieje." };

/**
 * One comment (and its parent) for deep links. A comment the viewer may not see (deleted,
 * hidden, held for review, or written by a deleted account) is reported as NOT_FOUND, so the
 * endpoint never reveals its content or even its existence. Moderators see hidden/held ones.
 */
export async function getCommentContext(
  input: GetCommentContextInput,
  ctx: AppContext
): Promise<UseCaseResult<GetCommentContextResult, CommentError>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;
  const repo = new CommentRepository(prisma);

  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail(NOT_FOUND);

    const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("COMMENT_CONTEXT_ACCESS_ERROR", accessResult.error));
    if (!accessResult.data.hasAccess) {
      if (accessResult.data.reason === 'NOT_FOUND' || accessResult.data.reason === 'DELETED') {
        return fail({ type: "NOT_FOUND", message: "Film nie istnieje lub został usunięty." });
      }
      // Match the public comment list: login/pass-required videos still expose their visible discussion.
      if (accessResult.data.reason !== 'LOGIN_REQUIRED' && accessResult.data.reason !== 'PASS_REQUIRED') {
        return fail({ type: "FORBIDDEN", message: "Brak dostępu do komentarzy." });
      }
    }

    const userId = actor.type === 'user' || actor.type === 'admin' ? actor.userId : null;
    const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
    const canModerate = await canModerateVideoComments(ctx, comment.videoId);
    const context: CommentDtoContext = { userId, canModerate, videoCreatorId, hasVideoAccess: accessResult.data.hasAccess };

    const isViewable = (row: { status: typeof comment.status; deletedReason: typeof comment.deletedReason; author: { isDeleted: boolean } | null }) =>
      canSeeCommentContent(row, context) && row.author?.isDeleted !== true;

    if (!isViewable(comment)) return fail(NOT_FOUND);

    const full = await repo.findCommentForDto(commentId, userId, canModerate);
    // Moderation or account deletion can happen between the lightweight lookup and the DTO read.
    if (!full || !isViewable(full)) return fail(NOT_FOUND);

    let parentComment: CommentDto | null = null;
    if (comment.parentId) {
      const parent = await repo.findCommentForDto(comment.parentId, userId, canModerate);
      if (parent && isViewable(parent)) parentComment = mapCommentToDto(parent, context);
    }

    return ok({
      comment: mapCommentToDto(full, context),
      parentComment,
      videoId: comment.videoId,
      canView: true,
    });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_CONTEXT_ERROR", error));
  }
}
