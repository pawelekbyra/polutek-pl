import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { sweepRoutelessReadyAssets } from "@/lib/modules/video-pipeline";

export const dynamic = "force-dynamic";

/**
 * Daily: hands READY own-HLS assets that never got a playback route (older than 7 days, no encode in progress) to the
 * regular cleanup job (audit U5). Nothing is deleted in this request. `?dryRun=1` only lists the candidates.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = createAppContext({ actor: { type: "system", reason: "sweep-routeless-assets-cron" } });
  const result = await sweepRoutelessReadyAssets({ dryRun: req.nextUrl.searchParams.get("dryRun") === "1" }, ctx);
  if (!result.ok) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
  return NextResponse.json(result.data);
}
