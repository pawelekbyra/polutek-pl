import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { resyncAdminVideoStats } from "@/lib/modules/video";
import { fromUseCaseResult } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { adminUserId, response } =
    await requireAdminForApi("RESYNC_VIDEO_STATS");
  if (response) return response;

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
    }

    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });

    const result = await resyncAdminVideoStats({ videoId }, ctx);

    return fromUseCaseResult(result);
  } catch (error) {
    return handleApiError(error);
  }
}
