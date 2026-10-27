import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentRepository } from "../infrastructure/comment.repository";
import type { ReactionTarget } from "../domain/comment.dto";
import { CommentStatus } from "@prisma/client";
import { notifyCommentLike, notifyCreatorLike } from "./comment-notifications";

export interface SetCommentReactionInput {
  commentId: string;
  /** The reaction the viewer wants to end up with; null clears it. Sending the same value twice changes nothing. */
  reaction: ReactionTarget;
}

export interface CommentReactionResult {
  viewerReaction: "LIKE" | "DISLIKE" | null;
  likesCount: number;
  /** Only when the reacting viewer is the channel's creator: the comment's heart after this reaction. */
  isHearted?: boolean;
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

    // The creator's like IS the heart: when the channel's creator likes a comment it gets the creator's heart (and
    // its author is told once), and taking the like back takes the heart off. Anyone else's like is a plain like.
    const creatorUserId = await new CommentRepository(prisma).findVideoCreatorId(comment.videoId);
    const likedByCreator = creatorUserId === userId && comment.authorId !== userId;

    // The heart is written in the same transaction as the reaction (under the reaction-pair lock), so concurrent
    // like/unlike of the creator cannot leave the heart opposite to the final reaction state.
    const { result, likeDelta, isHearted } = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const txRepo = new CommentRepository(tx);
      const { likeDelta } = await txRepo.setCommentReaction(userId, commentId, reaction);
      let isHearted: boolean | undefined;
      if (likedByCreator && likeDelta !== 0) {
        isHearted = likeDelta > 0;
        if (comment.isHearted !== isHearted) await txRepo.setHeart(commentId, isHearted);
      }
      return { result: await txRepo.getCommentReactionSnapshot(userId, commentId), likeDelta, isHearted };
    });
    if (isHearted && comment.isHearted !== isHearted) await notifyCreatorLike({ commentId });

    // Best-effort side effect, kept outside the transaction: a notification failure must never
    // roll back or fail the reaction itself. Only a like that actually got added notifies.
    if (likeDelta > 0 && comment.authorId !== userId && !likedByCreator) {
      await notifyCommentLike({ commentId, likerId: userId });
    }

    return ok(isHearted === undefined ? result : { ...result, isHearted });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_REACTION_ERROR", error));
  }
}
