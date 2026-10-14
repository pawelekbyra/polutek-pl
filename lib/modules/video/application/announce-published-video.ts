import { logger } from "@/lib/logger";

/**
 * Announces a freshly published video to the channel's followers (notification bell, CLAUDE.md
 * 4.18). Called AFTER the publication transaction committed and never throws: a failing notification
 * must not undo or fail a publication. An upcoming premiere is skipped (not announced yet).
 *
 * The notifications module is loaded lazily on purpose: the publish path (and its tests) must not
 * depend on it at import time.
 */
export async function announcePublishedVideo(videoId: string): Promise<void> {
  try {
    const { notifyNewVideoPublished } = await import("@/lib/modules/notifications");
    await notifyNewVideoPublished(videoId);
  } catch (error) {
    logger.error("[video] announcing a published video failed", { videoId, error: error instanceof Error ? error.message : String(error) });
  }
}
