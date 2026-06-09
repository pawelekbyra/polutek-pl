import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { PublicCommentDto, CommentAuthorBadgeDto } from "../domain/comment.dto";

export type CreateVideoCommentInput = {
  videoIdOrSlug: string;
  text: string;
  parentId?: string;
};

export async function createVideoComment(
  input: CreateVideoCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<PublicCommentDto, any>> {
  const { videoIdOrSlug, text, parentId } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest') return fail({ type: 'UNAUTHORIZED', message: 'Guest cannot comment' });

  // 1. Check video access
  const accessResult = await checkVideoAccess({ videoIdOrSlug }, ctx);
  if (!accessResult.ok) return accessResult as any;
  const access = accessResult.data;

  if (!access.hasAccess) return fail({ type: 'FORBIDDEN', message: 'No access to video' });

  // 2. Policy check
  const canCreate = CommentPolicy.canCreate(actor, access);
  if (!canCreate) return fail({ type: 'FORBIDDEN', message: 'Cannot post comment on this video' });

  // 3. Resolve video ID
  const { isUuid } = await import("@/lib/utils/uuid");
  const video = await prisma.video.findFirst({
    where: isUuid(videoIdOrSlug) ? { id: videoIdOrSlug } : { slug: videoIdOrSlug },
    select: { id: true }
  });
  if (!video) return fail({ type: 'NOT_FOUND', message: 'Video not found' });

  // 4. Create comment
  const userId = (actor as any).userId;
  const comment = await CommentRepository.create(prisma, {
    text,
    video: { connect: { id: video.id } },
    author: { connect: { id: userId } },
    parent: parentId ? { connect: { id: parentId } } : undefined,
    status: 'VISIBLE'
  });

  // 5. Map to DTO
  const badges: CommentAuthorBadgeDto[] = [];
  if (comment.author?.role === 'ADMIN') badges.push('ADMIN');
  if (comment.author?.isPatron) badges.push('PATRON');

  return ok({
    id: comment.id,
    videoId: comment.videoId,
    parentId: comment.parentId,
    text: comment.text,
    imageUrl: comment.imageUrl,
    status: comment.status as any,
    author: comment.author ? {
      id: comment.author.id,
      displayName: comment.author.name || 'Anonim',
      username: null,
      imageUrl: comment.author.imageUrl,
      badges
    } : null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() || null,
    pinnedAt: comment.pinnedAt?.toISOString() || null,
    likesCount: 0,
    repliesCount: 0,
    isPinned: false,
    isHearted: false,
    viewerReaction: null,
    viewerCanEdit: true,
    viewerCanDelete: true,
    viewerCanReport: true,
    viewerCanModerate: CommentPolicy.canModerate(actor),
    viewerCanPin: CommentPolicy.canModerate(actor)
  });
}
