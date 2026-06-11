import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { isUuid } from "@/lib/utils/uuid";

export interface ListVideoCommentsInput {
  videoId: string;
  sortBy: 'newest' | 'top' | 'oldest';
  cursor?: string;
  limit: number;
}

export interface ListVideoCommentsResult {
  comments: CommentDto[];
  totalCount: number;
  nextCursor: string | null;
  viewer: {
    canComment: boolean;
    canReact: boolean;
    canReport: boolean;
    canModerate: boolean;
  };
}

export async function listVideoComments(
  input: ListVideoCommentsInput,
  ctx: AppContext
): Promise<UseCaseResult<ListVideoCommentsResult, CommentError>> {
  const { videoId, sortBy, cursor, limit } = input;
  const { actor, prisma } = ctx;

  // 1. Resolve videoId if it's a slug
  let resolvedVideoId = videoId;
  if (!isUuid(videoId)) {
    const video = await prisma.video.findUnique({ where: { slug: videoId }, select: { id: true } });
    if (!video) return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });
    resolvedVideoId = video.id;
  }

  // 2. Access Check
  const accessResult = await checkVideoAccess({ videoIdOrSlug: resolvedVideoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  // Comments inherit video access for writing/interacting, but are publicly readable
  // if the video is published (even if it's patron-only).
  if (!accessResult.data.hasAccess) {
    const isPubliclyReadableReason = accessResult.data.reason === 'PATRON_REQUIRED' ||
                                     accessResult.data.reason === 'LOGIN_REQUIRED';

    if (!isPubliclyReadableReason) {
      if (accessResult.data.reason === 'NOT_FOUND' || accessResult.data.reason === 'DELETED') {
          return fail({ type: "NOT_FOUND", message: "Film nie istnieje lub został usunięty." });
      }
      return fail({
          type: "FORBIDDEN",
          message: "Brak dostępu do komentarzy."
      });
    }
  }

  const repo = new CommentRepository(prisma);

  // 3. Authorization for viewer context
  const userId = actor.type === 'user' || actor.type === 'admin' ? actor.userId : null;

  // Logic from CommentAccessService.canModerate:
  // Global admin or creator of the video can moderate.
  const isGlobalAdmin = actor.type === 'admin';
  const videoCreatorId = await repo.findVideoCreatorId(resolvedVideoId);
  const isVideoOwner = userId !== null && videoCreatorId === userId;
  const canModerate = isGlobalAdmin || isVideoOwner;

  // 4. Fetch comments
  const [comments, totalCount] = await Promise.all([
    repo.findMany({
        videoId: resolvedVideoId,
        userId,
        sortBy,
        cursor,
        limit,
        includeHidden: canModerate
    }),
    repo.count({
        videoId: resolvedVideoId,
        includeHidden: canModerate
    })
  ]);

  const context = { userId, canModerate, videoCreatorId, hasVideoAccess: accessResult.data.hasAccess };
  const mappedComments = comments.map(c => mapCommentToDto(c, context));

  return ok({
    comments: mappedComments,
    totalCount,
    nextCursor: comments.length === limit ? comments[limit - 1].id : null,
    viewer: {
        canComment: CommentPolicy.canCreateComment(actor, accessResult.data),
        canReact: CommentPolicy.canReactToComment(actor, accessResult.data),
        canReport: CommentPolicy.canReportComment(actor, accessResult.data),
        canModerate: CommentPolicy.canModerateComment(actor, canModerate)
    }
  });
}
