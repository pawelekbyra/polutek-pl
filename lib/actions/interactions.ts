'use server';

import { logger } from "@/lib/logger";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getActorFromAuth } from "@/lib/api/auth";
import { setVideoReaction as setVideoReactionUseCase, type CommentInteractionDto } from "@/lib/modules/comments";

export type VideoReactionActionResult =
  | (CommentInteractionDto & { error?: undefined })
  | { error: string; message: string };

/**
 * Sets the viewer's like/dislike of a video to `reaction` (null clears it) and returns the new
 * counters. Idempotent, and deliberately does not revalidate any path: the caller updates its
 * own state from the result, so a like never re-renders the page on the server.
 */
export async function setVideoReaction(
  videoId: string,
  reaction: "LIKE" | "DISLIKE" | null,
): Promise<VideoReactionActionResult> {
  // Server action arguments come straight from the client: check them at runtime.
  if (typeof videoId !== "string" || !videoId || !(reaction === "LIKE" || reaction === "DISLIKE" || reaction === null)) {
    return { error: "VALIDATION_ERROR", message: "Nieprawidłowe dane." };
  }
  try {
    const actor = await getActorFromAuth();
    const result = await setVideoReactionUseCase({ videoId, reaction }, createAppContext({ actor }));
    if (!result.ok) return { error: result.error.type, message: result.error.message };
    return result.data;
  } catch (error: unknown) {
    logger.error("[SET_VIDEO_REACTION_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}
