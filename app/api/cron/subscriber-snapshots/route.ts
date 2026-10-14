import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { snapshotSubscriberCounts } from "@/lib/modules/creator-analytics";

export const dynamic = "force-dynamic";

/**
 * Daily: writes one SubscriberSnapshot row per active channel for today (UTC). Idempotent (upsert on channel + day),
 * so a retry or a second run the same day is harmless. Feeds the subscriber chart in the Studio analytics.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = createAppContext({ actor: { type: "system", reason: "subscriber-snapshots-cron" } });
  try {
    const result = await snapshotSubscriberCounts(ctx);
    if (!result.ok) return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
