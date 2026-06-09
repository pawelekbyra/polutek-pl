import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";

export type DeleteCommentInput = {
  commentId: string;
};

export async function deleteComment(
  input: DeleteCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<{ success: true }, any>> {
  const { commentId } = input;
  const { actor, prisma } = ctx;

  // 1. Fetch comment
  const comment = await CommentRepository.findById(prisma, commentId);
  if (!comment) return fail({ type: 'NOT_FOUND', message: 'Comment not found' });

  // 2. Policy check
  const canDelete = CommentPolicy.canDelete(actor, comment.authorId);
  if (!canDelete) return fail({ type: 'FORBIDDEN', message: 'Cannot delete this comment' });

  // 3. Perform delete
  await CommentRepository.delete(prisma, commentId);

  return ok({ success: true });
}
