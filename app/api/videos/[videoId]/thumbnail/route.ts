import { NextRequest, NextResponse } from "next/server";
import { getGatedBlobResponse } from "@/lib/blob";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { checkVideoAccess } from "@/lib/modules/access";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ videoId: string }> }
) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const videoId = params.videoId;

  if (!videoId) {
    return NextResponse.json(
      { error: "Video ID is required" },
      { status: 400 }
    );
  }

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    // 1. Resolve video and its thumbnail URL
    const video = await ctx.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, thumbnailUrl: true }
    });

    if (!video || !video.thumbnailUrl) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    // 2. Access check (thumbnails are generally public but we follow video access for safety if it's a private store)
    // For hotfix, we use the same access logic as video but thumbnails could be more permissive.
    // However, getGatedBlobResponse already performs its own check.
    const userId = actor.type === "user" ? actor.userId : (actor.type === "admin" ? actor.userId : null);

    return getGatedBlobResponse(userId, video.id, video.thumbnailUrl, req.headers);
  } catch (error) {
    scopedLogger.error("[THUMBNAIL_PROXY_ERROR]", error);
    return handleApiError(error);
  }
}
