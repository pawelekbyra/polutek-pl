import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentRepository } from "../infrastructure/comment.repository";
import type { ReactionTarget } from "../domain/comment.dto";
import { CommentStatus, PrismaClient } from "@prisma/client";
import { sendNotification, notificationTemplates } from "@/lib/modules/notifications";
import { notifyCreatorLike } from "./comment-notifications";

export interface SetCommentReactionInput {
  commentId: string;
  /** The reaction the viewer wants to end up with; null clears it. Sending the same value twice changes nothing. */
  reaction: ReactionTarget;
}

export interface CommentReactionResult {
  viewerReaction: "LIKE" | "DISLIKE" | null;
  likesCount: number;
}

export async function setCommentReaction(
  input: SetCommentReactionInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentReactionResult, CommentError>> {
  const { commentId, reaction } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby ocenić komentarz." });
  }

  if (CommentPolicy.isOnboardingPending(actor)) {
    return fail({
      type: "FORBIDDEN",
      code: "ONBOARDING_REQUIRED",
      message: "Najpierw wybierz pseudonim w oknie powitalnym.",
    });
  }

  const userId = actor.userId;

  try {
    const comment = await new CommentRepository(prisma).findCommentById(commentId);
    if (!comment || comment.status !== CommentStatus.VISIBLE || comment.author?.isDeleted) {
      return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    }

    // Reacting to a comment requires video access (inheritance)
    const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("COMMENT_REACTION_ACCESS_ERROR", accessResult.error));
    if (!CommentPolicy.canReactToComment(actor, accessResult.data)) {
      return fail({ type: "FORBIDDEN", message: "Brak dostępu do interakcji pod tym filmem." });
    }

    const { result, likeDelta } = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const txRepo = new CommentRepository(tx);
      const { likeDelta } = await txRepo.setCommentReaction(userId, commentId, reaction);
      return { result: await txRepo.getCommentReactionSnapshot(userId, commentId), likeDelta };
    });

    // Best-effort side effect, kept outside the transaction: a notification failure must never
    // roll back or fail the reaction itself. Only a like that actually got added notifies.
    if (likeDelta > 0 && comment.authorId !== userId) {
      try {
        const video = await (prisma as PrismaClient).video.findUnique({ where: { id: comment.videoId }, select: { slug: true, creator: { select: { userId: true } } } });
        // The creator's like is its own, more personal notification (once per comment), instead of the anonymous one.
        if (video?.creator?.userId === userId) {
          await notifyCreatorLike({ commentId });
          return ok(result);
        }
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
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_REACTION_ERROR", error));
  }
}
