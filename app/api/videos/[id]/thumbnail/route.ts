import { NextRequest, NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { ThumbnailResponseService } from "@/lib/services/storage/thumbnail-response.service";
import { resolveVideoThumbnailUrl } from "@/lib/services/storage/default-thumbnail.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const videoId = params.id;

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
      select: { id: true, thumbnailUrl: true, status: true }
    });

    if (!video) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    // 2. Thumbnail Access Policy
    // - Published videos: thumbnails are public (regardless of patron-only playback).
    // - Drafts/Archived/Unpublished: admin-only.
    const isPublic = video.status === "PUBLISHED";
    const isAdmin = actor.type === "admin";

    if (!isPublic && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Video is not public" }, { status: 403 });
    }

    // 3. Resolve thumbnail URL, falling back to global default if not set
    const resolvedUrl = await resolveVideoThumbnailUrl(video.thumbnailUrl);
    if (!resolvedUrl) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    // 4. Delegate to ThumbnailResponseService to handle storage streaming/redirect
    return ThumbnailResponseService.getThumbnailResponse(video.id, resolvedUrl);

  } catch (error) {
    scopedLogger.error("[THUMBNAIL_PROXY_ERROR]", error);
    return handleApiError(error);
  }
}
