import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentRepository } from "../infrastructure/comment.repository";
import { PrismaClient } from "@prisma/client";
import { sendNotification, notificationTemplates } from "@/lib/modules/notifications";

export interface ToggleCommentLikeInput {
  commentId: string;
  /** LIKE/DISLIKE set that reaction (replacing the other), UNLIKE clears any reaction. */
  action: 'LIKE' | 'DISLIKE' | 'UNLIKE';
}

export async function toggleCommentLike(
  input: ToggleCommentLikeInput,
  ctx: AppContext
): Promise<UseCaseResult<{ liked: boolean; viewerReaction: string | null; likesCount: number }, CommentError>> {
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

  // Reacting to a comment requires video access (inheritance)
  if (!CommentPolicy.canReactToComment(actor, accessResult.data)) {
    return fail({
      type: "FORBIDDEN",
      message: accessResult.data.reason === "PATRON_REQUIRED"
        ? "Interakcje pod tym filmem są dostępne tylko dla Patronów."
        : "Brak dostępu do interakcji pod tym filmem."
    });
  }

  try {
    let isNewLike = false;

    const result = await (prisma as PrismaClient).$transaction(async (tx) => {
      const txRepo = new CommentRepository(tx);
      const existing = await txRepo.findCommentReaction(userId, commentId);

      if (action === 'LIKE') {
        if (existing && existing.type !== 'LIKE') await txRepo.deleteCommentReaction(existing.id, commentId, existing.type);
        if (!existing || existing.type !== 'LIKE') {
          await txRepo.createCommentLike(userId, commentId);
          isNewLike = true;
        }
      } else if (action === 'DISLIKE') {
        if (existing && existing.type !== 'DISLIKE') await txRepo.deleteCommentReaction(existing.id, commentId, existing.type);
        if (!existing || existing.type !== 'DISLIKE') await txRepo.createCommentDislike(userId, commentId);
      } else {
        if (existing) await txRepo.deleteCommentReaction(existing.id, commentId, existing.type);
      }

      const snapshot = await txRepo.getCommentReactionSnapshot(userId, commentId);
      return { ...snapshot, liked: action === 'LIKE' };
    });

    // Best-effort side effect, kept outside the transaction: a notification failure
    // must never roll back or fail the like/unlike action itself.
    if (isNewLike && comment.authorId !== userId) {
      try {
        const video = await (prisma as PrismaClient).video.findUnique({ where: { id: comment.videoId }, select: { slug: true } });
        await sendNotification({
          userId: comment.authorId,
          kind: notificationTemplates.commentLike.kind,
          titlePl: notificationTemplates.commentLike.titlePl,
          titleEn: notificationTemplates.commentLike.titleEn,
          bodyPl: notificationTemplates.commentLike.bodyPl,
          bodyEn: notificationTemplates.commentLike.bodyEn,
          href: video ? `/?v=${encodeURIComponent(video.slug)}#comment-${commentId}` : undefined,
        });
      } catch (notificationError) {
        console.error("[COMMENT_LIKE_NOTIFICATION_ERROR]", notificationError);
      }
    }

    return ok(result);
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
