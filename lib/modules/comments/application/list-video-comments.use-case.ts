import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { CommentListDto, PublicCommentDto, CommentAuthorBadgeDto } from "../domain/comment.dto";

export type ListVideoCommentsInput = {
  videoIdOrSlug: string;
};

export async function listVideoComments(
  input: ListVideoCommentsInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentListDto, any>> {
  const { videoIdOrSlug } = input;
  const { actor, prisma } = ctx;

  // 1. Check video access
  const accessResult = await checkVideoAccess({ videoIdOrSlug }, ctx);
  if (!accessResult.ok) return accessResult;
  const access = accessResult.data;

  // 2. Check if actor can view comments (via policy)
  const canView = CommentPolicy.canView(actor, access);
  if (!canView) return ok({
    comments: [],
    totalCount: 0,
    nextCursor: null,
    hasMore: false,
    viewer: { canComment: false, canReact: false, canReport: false, canModerate: false }
  });

  // 3. Resolve internal video ID if input was a slug
  const { isUuid } = await import("@/lib/utils/uuid");
  const video = await prisma.video.findFirst({
    where: isUuid(videoIdOrSlug) ? { id: videoIdOrSlug } : { slug: videoIdOrSlug },
    select: { id: true }
  });
  if (!video) return fail({ type: 'NOT_FOUND', message: 'Video not found' });

  // 4. Fetch comments
  const userId = actor.type === 'user' || actor.type === 'admin' ? (actor as any).userId : undefined;
  const comments = await CommentRepository.listByVideoId(prisma, video.id, userId);

  // 5. Map to DTO
  const mappedComments: PublicCommentDto[] = comments.map(c => {
    const badges: CommentAuthorBadgeDto[] = [];
    if (c.author?.role === 'ADMIN') badges.push('ADMIN');
    if (c.author?.isPatron) badges.push('PATRON');

    return {
      id: c.id,
      videoId: c.videoId,
      parentId: c.parentId,
      text: c.text,
      imageUrl: c.imageUrl,
      status: c.status as any,
      author: c.author ? {
        id: c.author.id,
        displayName: c.author.name || 'Anonim',
        username: null,
        imageUrl: c.author.imageUrl,
        badges
      } : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      editedAt: c.editedAt?.toISOString() || null,
      pinnedAt: c.pinnedAt?.toISOString() || null,
      likesCount: c._count.reactions,
      repliesCount: c._count.replies,
      isPinned: !!c.pinnedAt,
      isHearted: c.isHearted,
      viewerReaction: c.reactions?.length > 0 ? 'LIKE' : null,
      viewerCanEdit: CommentPolicy.canUpdate(actor, c.authorId),
      viewerCanDelete: CommentPolicy.canDelete(actor, c.authorId),
      viewerCanReport: actor.type !== 'guest',
      viewerCanModerate: CommentPolicy.canModerate(actor),
      viewerCanPin: CommentPolicy.canModerate(actor)
    };
  });

  return ok({
    comments: mappedComments,
    totalCount: mappedComments.length,
    nextCursor: null,
    hasMore: false,
    viewer: {
      canComment: CommentPolicy.canCreate(actor, access),
      canReact: CommentPolicy.canReact(actor, access),
      canReport: actor.type !== 'guest',
      canModerate: CommentPolicy.canModerate(actor)
    }
  });
}
