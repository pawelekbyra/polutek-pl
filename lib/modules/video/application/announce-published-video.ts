import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

/**
 * Persists the announcement intent inside the publication transaction. Unlike the post-commit runner
 * kick, this must throw on failure so the transaction rolls back instead of publishing without an intent.
 *
 * The notifications module is loaded lazily on purpose: the publish path (and its tests) must not
 * depend on it at import time.
 */
export async function enqueuePublishedVideoAnnouncement(videoId: string, tx: Prisma.TransactionClient, now?: Date): Promise<boolean> {
  const { enqueuePublishedVideoAnnouncement: enqueue } = await import("@/lib/modules/notifications");
  return enqueue(videoId, tx, now);
}

/** Starts processing an already committed intent; durable cron recovery covers a failed kick. */
export async function announcePublishedVideo(videoId: string): Promise<void> {
  try {
    const { kickNewVideoFanOutJobs } = await import("@/lib/modules/notifications");
    kickNewVideoFanOutJobs();
  } catch (error) {
    logger.error("[video] kicking the committed publication announcement failed", { videoId, error: error instanceof Error ? error.message : String(error) });
  }
}
