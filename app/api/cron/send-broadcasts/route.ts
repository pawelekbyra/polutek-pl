import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { BroadcastQueueRepository, processBroadcastQueue } from "@/lib/modules/email";

export const dynamic = "force-dynamic";

/**
 * Sends queued admin broadcasts. Called every minute by the systemd timer
 * polutek-cron-send-broadcasts (deploy/serwerek/systemd). One call works for about 50 s on one
 * broadcast and returns; the queue state lives in Postgres, so a restart loses nothing.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processBroadcastQueue({ store: new BroadcastQueueRepository(prisma) });
    if (result.broadcastId) logger.info("[cron] send-broadcasts", result);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("[cron] send-broadcasts failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
