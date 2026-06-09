import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { PublicCommentDto, CommentAuthorBadgeDto } from "../domain/comment.dto";

export type UpdateCommentInput = {
  commentId: string;
  text: string;
};

export async function updateComment(
  input: UpdateCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<PublicCommentDto, any>> {
  const { commentId, text } = input;
  const { actor, prisma } = ctx;

  // 1. Fetch comment
  const comment = await CommentRepository.findById(prisma, commentId);
  if (!comment) return fail({ type: 'NOT_FOUND', message: 'Comment not found' });

  // 2. Policy check
  const canUpdate = CommentPolicy.canUpdate(actor, comment.authorId);
  if (!canUpdate) return fail({ type: 'FORBIDDEN', message: 'Cannot update this comment' });

  // 3. Perform update
  const updated = await CommentRepository.update(prisma, commentId, {
    text,
    editedAt: new Date()
  });

  // 4. Map to DTO
  const badges: CommentAuthorBadgeDto[] = [];
  if (updated.author?.role === 'ADMIN') badges.push('ADMIN');
  if (updated.author?.isPatron) badges.push('PATRON');

  return ok({
    id: updated.id,
    videoId: updated.videoId,
    parentId: updated.parentId,
    text: updated.text,
    imageUrl: updated.imageUrl,
    status: updated.status as any,
    author: updated.author ? {
      id: updated.author.id,
      displayName: updated.author.name || 'Anonim',
      username: null,
      imageUrl: updated.author.imageUrl,
      badges
    } : null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    editedAt: updated.editedAt?.toISOString() || null,
    pinnedAt: updated.pinnedAt?.toISOString() || null,
    likesCount: 0, // Simplified for update response
    repliesCount: 0,
    isPinned: !!updated.pinnedAt,
    isHearted: updated.isHearted,
    viewerReaction: null,
    viewerCanEdit: true,
    viewerCanDelete: true,
    viewerCanReport: true,
    viewerCanModerate: CommentPolicy.canModerate(actor),
    viewerCanPin: CommentPolicy.canModerate(actor)
  });
}
