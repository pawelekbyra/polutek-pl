import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { abandonStaleOriginalUploads } from "@/lib/modules/video-pipeline";

export const dynamic = "force-dynamic";

/** Daily: closes original-video uploads left unfinished for 7 days (see abandonStaleOriginalUploads). `?dryRun=1` only counts. */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = createAppContext({ actor: { type: "system", reason: "abandon-stale-uploads-cron" } });
  const result = await abandonStaleOriginalUploads({ dryRun: req.nextUrl.searchParams.get("dryRun") === "1" }, ctx);
  if (!result.ok) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
  return NextResponse.json(result.data);
}
