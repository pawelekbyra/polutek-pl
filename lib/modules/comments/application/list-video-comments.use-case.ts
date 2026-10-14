import { AppContext } from "@/lib/modules/shared/app-context";
import { canModerateVideoComments } from "./authorize-comments";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { isUuid } from "@/lib/utils/uuid";

export interface ListVideoCommentsInput {
  videoId: string;
  sortBy: 'newest' | 'top';
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
    /** The creator turned comments off for this video: existing comments stay readable, the composer says why. */
    commentsDisabled: boolean;
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
     return fail(commentDatabaseError("COMMENT_LIST_ACCESS_ERROR", accessResult.error));
  }

  // Comments inherit video access for writing/interacting, but are publicly readable
  // if the video is published (even if it's patron-only).
  if (!accessResult.data.hasAccess) {
    const isPubliclyReadableReason = accessResult.data.reason === 'LOGIN_REQUIRED';

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

  // Moderation on the public site is a role in the video's channel (owner, manager, moderator), not the global
  // ADMIN role: platform staff moderate in the admin panel.
  const videoCreatorId = await repo.findVideoCreatorId(resolvedVideoId);
  const canModerate = await canModerateVideoComments(ctx, resolvedVideoId);

  // 4. Fetch comments (one extra row tells whether another page exists)
  const [rows, totalCount] = await Promise.all([
    repo.findMany({
        videoId: resolvedVideoId,
        userId,
        sortBy,
        cursor,
        limit: limit + 1,
        includeHidden: canModerate
    }),
    repo.count({
        videoId: resolvedVideoId,
        includeHidden: canModerate
    })
  ]);

  const videoRow = await prisma.video.findUnique({ where: { id: resolvedVideoId }, select: { commentsMode: true } });
  const commentsDisabled = CommentPolicy.statusForNewComment(videoRow?.commentsMode, canModerate) === null;

  const context = { userId, canModerate, videoCreatorId, hasVideoAccess: accessResult.data.hasAccess };
  const comments = rows.slice(0, limit);
  const mappedComments = comments.map(c => mapCommentToDto(c, context));

  return ok({
    comments: mappedComments,
    totalCount,
    nextCursor: rows.length > limit ? comments[comments.length - 1].id : null,
    viewer: {
        canComment: CommentPolicy.canCreateComment(actor, accessResult.data),
        canReact: CommentPolicy.canReactToComment(actor, accessResult.data),
        canReport: CommentPolicy.canReportComment(actor, accessResult.data),
        canModerate: CommentPolicy.canModerateComment(actor, canModerate),
        commentsDisabled,
    }
  });
}
