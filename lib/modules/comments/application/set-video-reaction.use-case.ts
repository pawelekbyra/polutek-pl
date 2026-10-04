import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentInteractionDto } from "../domain/comment.dto";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentRepository } from "../infrastructure/comment.repository";
import type { ReactionTarget } from "../domain/comment.dto";

export interface SetVideoReactionInput {
  videoId: string;
  /** The reaction the viewer wants to end up with; null clears it. Sending the same value twice changes nothing. */
  reaction: ReactionTarget;
}

/**
 * Sets the viewer's like/dislike of a video to an explicit target state. Idempotent: a double
 * click or a retried request cannot flip the state back or count twice.
 */
export async function setVideoReaction(
  input: SetVideoReactionInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentInteractionDto, CommentError>> {
  const { videoId, reaction } = input;
  const { actor } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby ocenić film." });
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
    const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("VIDEO_REACTION_ACCESS_ERROR", accessResult.error));
    if (!CommentPolicy.canReactToVideo(actor, accessResult.data)) {
      if (accessResult.data.reason === 'NOT_FOUND' || accessResult.data.reason === 'DELETED') {
        return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });
      }
      return fail({ type: "FORBIDDEN", message: "Brak dostępu do interakcji z tym filmem." });
    }

    const result = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const txRepo = new CommentRepository(tx);
      await txRepo.setVideoReaction(userId, videoId, reaction);
      return await txRepo.getVideoReactionSnapshot(userId, videoId);
    });

    return ok(result);
  } catch (error) {
    return fail(commentDatabaseError("VIDEO_REACTION_ERROR", error));
  }
}
