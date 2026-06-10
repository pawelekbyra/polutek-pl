import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
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

export async function getCommentContext(
  input: GetCommentContextInput,
  ctx: AppContext
): Promise<UseCaseResult<GetCommentContextResult, CommentError>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  const repo = new CommentRepository(prisma);
  const comment = await repo.findCommentById(commentId);

  if (!comment) {
    return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
  }

  // Access Check for the video the comment belongs to
  const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  // Comments inherit video access
  if (!accessResult.data.hasAccess) {
    if (accessResult.data.reason === 'NOT_FOUND' || accessResult.data.reason === 'DELETED') {
        return fail({ type: "NOT_FOUND", message: "Film nie istnieje lub został usunięty." });
    }
    return fail({
        type: "FORBIDDEN",
        message: accessResult.data.reason === "PATRON_REQUIRED"
            ? "Komentarze pod tym filmem są dostępne tylko dla Patronów."
            : "Brak dostępu do komentarzy."
    });
  }

  const userId = actor.type === 'user' || actor.type === 'admin' ? actor.userId : null;
  const isGlobalAdmin = actor.type === 'admin';
  const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
  const canModerate = isGlobalAdmin || (userId !== null && videoCreatorId === userId);

  const context = { userId, canModerate, videoCreatorId, hasVideoAccess: accessResult.data.hasAccess };

  let parentCommentDto: CommentDto | null = null;
  if (comment.parentId) {
      const parent = await repo.findCommentById(comment.parentId);
      if (parent) {
          parentCommentDto = mapCommentToDto(parent, context);
      }
  }

  return ok({
    comment: mapCommentToDto(comment, context),
    parentComment: parentCommentDto,
    videoId: comment.videoId,
    canView: true
  });
}
