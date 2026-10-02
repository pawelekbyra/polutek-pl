import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { pruneUnverifiedAccounts } from "@/lib/auth/prune-unverified";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await pruneUnverifiedAccounts());
  } catch (error) {
    logger.error("[cron] prune-unverified-accounts failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
