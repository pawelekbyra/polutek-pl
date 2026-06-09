import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";

export type ToggleCommentReactionInput = {
  commentId: string;
  type: 'LIKE';
  action: 'TOGGLE';
};

export async function toggleCommentReaction(
  input: ToggleCommentReactionInput,
  ctx: AppContext
): Promise<UseCaseResult<{ liked: boolean }, any>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest') return fail({ type: 'UNAUTHORIZED', message: 'Guest cannot react' });

  // 1. Fetch comment to get videoId
  const comment = await CommentRepository.findById(prisma, commentId);
  if (!comment) return fail({ type: 'NOT_FOUND', message: 'Comment not found' });

  // 2. Check video access (Central Access Safety)
  // FIX: Non-patron must be blocked on patron-only video reactions
  const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
  if (!accessResult.ok) return accessResult as any;
  const access = accessResult.data;

  // 3. Policy check
  const canReact = CommentPolicy.canReact(actor, access);
  if (!canReact) return fail({ type: 'FORBIDDEN', message: 'Cannot react to comments on this video' });

  // 4. Perform toggle
  const userId = (actor as any).userId;
  const existing = await CommentRepository.findReaction(prisma, commentId, userId);

  if (existing) {
    await CommentRepository.deleteReaction(prisma, commentId, userId);
    return ok({ liked: false });
  } else {
    await CommentRepository.createReaction(prisma, commentId, userId);
    return ok({ liked: true });
  }
}
