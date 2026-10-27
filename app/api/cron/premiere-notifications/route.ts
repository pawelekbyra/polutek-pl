import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { notifyDuePremieres, runNewVideoFanOutJobs } from "@/lib/modules/notifications";
import { runStorageCleanupJobs } from "@/lib/modules/admin-content";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Every minute, the runner of the durable job queue (`DurableJob`, lib/modules/shared/durable-job.ts):
 * 1. puts the premieres whose time has come in the queue (`notifyDuePremieres`: one NEW_VIDEO_FANOUT job per video);
 * 2. runs NEW_VIDEO_FANOUT jobs (in-app notifications in resumable pages, also publish-time fan-outs a dead
 *    process left half-way);
 * 3. runs STORAGE_CLEANUP jobs (R2 objects of deleted videos, retried until confirmed).
 * Safe to overlap or repeat: a job is taken with a lease, and its notifications are deduped per (user, video).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const premieres = await notifyDuePremieres({ batchSize: 50 });
    const fanOut = await runNewVideoFanOutJobs();
    const cleanup = await runStorageCleanupJobs();
    return NextResponse.json({ ...premieres, fanOut, cleanup });
  } catch (error) {
    logger.error("[cron] premiere-notifications failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
