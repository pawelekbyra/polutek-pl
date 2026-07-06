import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { VideoDistributionBackfillService } from "@/lib/modules/video";

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_DISTRIBUTION_BACKFILL");
  if (response) return response;
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 25), 200);
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const result = await new VideoDistributionBackfillService().backfillExistingVideos({ limit, dryRun: body.dryRun !== false, videoId: typeof body.videoId === "string" ? body.videoId : undefined }, ctx);
    return NextResponse.json(result);
  } catch (error) { return handleApiError(error); }
}
