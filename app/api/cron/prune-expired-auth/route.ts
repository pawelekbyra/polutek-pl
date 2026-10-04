import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { pruneExpiredAuthRecords } from "@/lib/auth/prune-expired";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Daily: deletes expired sign-in sessions and expired e-mail link tokens. */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await pruneExpiredAuthRecords());
  } catch (error) {
    logger.error("[cron] prune-expired-auth failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
