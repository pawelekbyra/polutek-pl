import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentInteractionDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { PrismaClient } from "@prisma/client";

export interface ToggleVideoDislikeInput {
  videoId: string;
}

export async function toggleVideoDislike(
  input: ToggleVideoDislikeInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentInteractionDto, CommentError>> {
  const { videoId } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby ocenić film." });
  }

  const userId = actor.userId;

  // 1. Access Check
  const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  if (!CommentPolicy.canReactToVideo(actor, accessResult.data)) {
    return fail({
        type: "FORBIDDEN",
        message: accessResult.data.reason === "PATRON_REQUIRED"
            ? "Ten film jest dostępny tylko dla Patronów."
            : "Brak dostępu do interakcji z tym filmem."
    });
  }

  try {
    const result = await (prisma as PrismaClient).$transaction(async (tx) => {
      const txRepo = new CommentRepository(tx);

      const existingLike = await txRepo.findVideoLike(userId, videoId);
      const existingDislike = await txRepo.findVideoDislike(userId, videoId);

      // If liked, remove like first
      if (existingLike) {
        await txRepo.deleteVideoLike(existingLike.id, videoId);
      }

      if (existingDislike) {
        await txRepo.deleteVideoDislike(existingDislike.id, videoId);
        return { liked: false, disliked: false };
      } else {
        await txRepo.createVideoDislike(userId, videoId);
        return { liked: false, disliked: true };
      }
    });

    await recordAuditEvent(ctx, {
        action: result.disliked ? "VIDEO_DISLIKE" : "VIDEO_UNDISLIKE",
        targetType: "VIDEO",
        targetId: videoId,
    });

    return ok(result);
  } catch (error:
any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
