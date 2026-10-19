import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { notifyDuePremieres } from "@/lib/modules/notifications";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Every minute: tells the followers of a channel that a scheduled premiere has started (in-app NEW_VIDEO
 * notification with premiere text). Bounded batch per run; idempotent (each video is claimed atomically via
 * `Video.premiereNotifiedAt`), so overlapping or repeated runs never double-send.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await notifyDuePremieres({ batchSize: 50 });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("[cron] premiere-notifications failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
