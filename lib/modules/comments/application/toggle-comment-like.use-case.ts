import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentRepository } from "../infrastructure/comment.repository";
import { PrismaClient } from "@prisma/client";

export interface ToggleCommentLikeInput {
  commentId: string;
  action: 'LIKE' | 'UNLIKE';
}

export async function toggleCommentLike(
  input: ToggleCommentLikeInput,
  ctx: AppContext
): Promise<UseCaseResult<{ liked: boolean }, CommentError>> {
  const { commentId, action } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby ocenić komentarz." });
  }

  const userId = actor.userId;
  const repo = new CommentRepository(prisma);

  const comment = await repo.findCommentById(commentId);
  if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

  // 1. Access Check for the video the comment belongs to
  const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  // Use the same policy for now: if you can view comments, you can react
  if (!accessResult.data.hasAccess && accessResult.data.reason !== 'PATRON_REQUIRED') {
    return fail({ type: "FORBIDDEN", message: "Brak dostępu do tego filmu." });
  }

  try {
    const result = await (prisma as PrismaClient).$transaction(async (tx) => {
      const txRepo = new CommentRepository(tx);
      const existing = await txRepo.findCommentReaction(userId, commentId);

      if (action === 'LIKE') {
        if (existing) return { liked: true };
        await txRepo.createCommentLike(userId, commentId);
        return { liked: true };
      } else {
        if (!existing) return { liked: false };
        await txRepo.deleteCommentReaction(existing.id, commentId);
        return { liked: false };
      }
    });

    return ok(result);
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
