'use server';

import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateCurrentUser } from "@/lib/modules/users";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { revalidatePath } from "next/cache";
import { getActorFromAuth } from "@/lib/api/auth";
import { toggleVideoLike as toggleLikeUseCase, toggleVideoDislike as toggleDislikeUseCase } from "@/lib/modules/comments";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Toggles a 'Like' on a video.
 */
export async function toggleVideoLike(videoId: string) {
  try {
      const actor = await getActorFromAuth();
      const ctx = createAppContext({ actor });

      // 1. Sync/Fetch user record (Legacy requirement for Server Actions to ensure user exists in DB)
      if (actor.type === 'user') {
          try {
              const { sessionClaims } = await auth();
              await getOrCreateCurrentUser(ctx, actor.userId, sessionClaims);
          } catch (err: unknown) {
              logger.error("[Interaction] UserService sync issue:", getErrorMessage(err));
              return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika." };
          }
      }

      const result = await toggleLikeUseCase({ videoId }, ctx);

      if (!result.ok) {
          return { error: result.error.type, message: result.error.message };
      }

      revalidatePath('/', 'layout');
      return result.data;
  } catch (error: unknown) {
    logger.error("[TOGGLE_LIKE_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: getErrorMessage(error) };
  }
}

/**
 * Toggles a 'Dislike' on a video.
 */
export async function toggleVideoDislike(videoId: string) {
  try {
      const actor = await getActorFromAuth();
      const ctx = createAppContext({ actor });

      if (actor.type === 'user') {
          try {
              const { sessionClaims } = await auth();
              await getOrCreateCurrentUser(ctx, actor.userId, sessionClaims);
          } catch (err: unknown) {
              logger.error("[Interaction] UserService sync issue:", getErrorMessage(err));
              return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika." };
          }
      }

      const result = await toggleDislikeUseCase({ videoId }, ctx);

      if (!result.ok) {
          return { error: result.error.type, message: result.error.message };
      }

      revalidatePath('/', 'layout');
      return result.data;
  } catch (error: unknown) {
    logger.error("[TOGGLE_DISLIKE_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: getErrorMessage(error) };
  }
}
