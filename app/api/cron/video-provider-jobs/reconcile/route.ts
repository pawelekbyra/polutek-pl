import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { VideoProviderReconcilerService } from "@/lib/modules/video/application/video-provider-reconciler.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ctx = createAppContext({ actor: { type: "system", reason: "video-provider-jobs-reconcile-cron" } });
  const result = await new VideoProviderReconcilerService().reconcilePendingProviderJobs({}, ctx);
  return NextResponse.json(result);
}
