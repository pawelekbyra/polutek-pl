import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentStatus } from "@prisma/client";

export interface ListCommentRepliesInput {
  commentId: string;
  cursor?: string;
  limit: number;
}

export async function listCommentReplies(
  input: ListCommentRepliesInput,
  ctx: AppContext
): Promise<UseCaseResult<{ replies: CommentDto[], nextCursor: string | null }, CommentError>> {
  const { commentId, cursor, limit } = input;
  const { actor, prisma } = ctx;

  const repo = new CommentRepository(prisma);
  const parentComment = await repo.findCommentById(commentId);
  if (!parentComment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

  // 1. Access Check for the video the comment belongs to
  const accessResult = await checkVideoAccess({ videoIdOrSlug: parentComment.videoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  // Same rule as listVideoComments
  if (!accessResult.data.hasAccess && (accessResult.data.reason === 'NOT_FOUND' || accessResult.data.reason === 'DELETED')) {
      return fail({ type: "NOT_FOUND", message: "Film nie istnieje lub został usunięty." });
  }

  const userId = actor.type === 'user' || actor.type === 'admin' ? actor.userId : null;
  const isGlobalAdmin = actor.type === 'admin';
  const videoCreatorId = await repo.findVideoCreatorId(parentComment.videoId);
  const canModerate = isGlobalAdmin || (userId !== null && videoCreatorId === userId);

  const replies = await repo.findReplies(commentId, userId, canModerate, cursor, limit);

  const context = { userId, canModerate, videoCreatorId };
  const mappedReplies = replies.map(r => mapCommentToDto(r, context));

  return ok({
    replies: mappedReplies,
    nextCursor: replies.length === limit ? replies[limit - 1].id : null
  });
}
