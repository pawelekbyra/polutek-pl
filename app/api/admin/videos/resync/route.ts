import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { resyncAdminVideoStats } from "@/lib/modules/video";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminVideoResyncSchema } from "@/lib/api/admin-schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { adminUserId, response } =
    await requireAdminForApi("RESYNC_VIDEO_STATS");
  if (response) return response;

  try {
    const parsed = await parseAdminBody(req, adminVideoResyncSchema, { errorMessage: "Missing videoId" });
    if (!parsed.ok) return parsed.response;
    const { videoId } = parsed.data;

    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });

    const result = await resyncAdminVideoStats({ videoId }, ctx);

    return fromUseCaseResult(result);
  } catch (error) {
    return handleApiError(error);
  }
}
