import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { PublicCommentDto, CommentAuthorBadgeDto } from "../domain/comment.dto";

export type ListCommentRepliesInput = {
  commentId: string;
};

export async function listCommentReplies(
  input: ListCommentRepliesInput,
  ctx: AppContext
): Promise<UseCaseResult<{ replies: PublicCommentDto[] }, any>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  // 1. Fetch parent comment to get videoId and check access
  const parent = await CommentRepository.findById(prisma, commentId);
  if (!parent) return fail({ type: 'NOT_FOUND', message: 'Comment not found' });

  // 2. Check video access (Since replies are on the same video)
  const { checkVideoAccess } = await import("@/lib/modules/access");
  const accessResult = await checkVideoAccess({ videoIdOrSlug: parent.videoId }, ctx);
  if (!accessResult.ok) return accessResult as any;
  const access = accessResult.data;

  // 3. Policy check
  const canView = CommentPolicy.canView(actor, access);
  if (!canView) return ok({ replies: [] });

  // 4. Fetch replies
  const userId = actor.type === 'user' || actor.type === 'admin' ? (actor as any).userId : undefined;
  const replies = await prisma.comment.findMany({
    where: {
      parentId: commentId,
      status: 'VISIBLE'
    },
    include: {
      author: {
        select: { id: true, name: true, role: true, isPatron: true, imageUrl: true }
      },
      _count: {
        select: { reactions: true, replies: true }
      },
      reactions: userId ? {
          where: { userId }
      } : false
    },
    orderBy: { createdAt: 'asc' }
  });

  // 5. Map to DTO
  const mappedReplies: PublicCommentDto[] = replies.map(r => {
    const badges: CommentAuthorBadgeDto[] = [];
    if (r.author?.role === 'ADMIN') badges.push('ADMIN');
    if (r.author?.isPatron) badges.push('PATRON');

    return {
      id: r.id,
      videoId: r.videoId,
      parentId: r.parentId,
      text: r.text,
      imageUrl: r.imageUrl,
      status: r.status as any,
      author: r.author ? {
        id: r.author.id,
        displayName: r.author.name || 'Anonim',
        username: null,
        imageUrl: r.author.imageUrl,
        badges
      } : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      editedAt: r.editedAt?.toISOString() || null,
      pinnedAt: r.pinnedAt?.toISOString() || null,
      likesCount: r._count.reactions,
      repliesCount: r._count.replies,
      isPinned: !!r.pinnedAt,
      isHearted: r.isHearted,
      viewerReaction: r.reactions?.length > 0 ? 'LIKE' : null,
      viewerCanEdit: CommentPolicy.canUpdate(actor, r.authorId),
      viewerCanDelete: CommentPolicy.canDelete(actor, r.authorId),
      viewerCanReport: actor.type !== 'guest',
      viewerCanModerate: CommentPolicy.canModerate(actor),
      viewerCanPin: CommentPolicy.canModerate(actor)
    };
  });

  return ok({ replies: mappedReplies });
}
