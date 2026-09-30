import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { VideoDistributionBackfillService } from "@/lib/modules/video";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminDistributionBackfillSchema } from "@/lib/api/admin-schemas";

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_DISTRIBUTION_BACKFILL");
  if (response) return response;
  try {
    const parsed = await parseAdminBody(req, adminDistributionBackfillSchema, { allowEmpty: true });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const limit = Math.min(Number(body.limit ?? 25), 200);
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const result = await new VideoDistributionBackfillService().backfillExistingVideos({ limit, dryRun: body.dryRun !== false, videoId: body.videoId }, ctx);
    return NextResponse.json(result);
  } catch (error) { return handleApiError(error); }
}
