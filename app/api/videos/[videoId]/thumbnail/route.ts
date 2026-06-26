import { NextRequest, NextResponse } from "next/server";
import { getGatedBlobResponse } from "@/lib/blob";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { MediaPolicy } from "@/lib/modules/media";

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
      select: { id: true, thumbnailUrl: true, status: true }
    });

    if (!video || !video.thumbnailUrl) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    // 2. Thumbnail Access Policy
    // - Public/Published videos: thumbnails are public.
    // - Drafts/Archived/Unpublished: admin-only.
    const isPublic = video.status === "PUBLISHED";
    const isAdmin = actor.type === "admin";

    if (!isPublic && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Video is not public" }, { status: 403 });
    }

    // 3. Handle different URL types
    const thumbnailUrl = video.thumbnailUrl;

    // Validate the host
    if (!MediaPolicy.isAllowedThumbnailUrl(thumbnailUrl, process.env)) {
      scopedLogger.warn("[THUMBNAIL_PROXY_BLOCKED_HOST]", { thumbnailUrl });
      return NextResponse.json({ error: "Unauthorized Thumbnail Host" }, { status: 403 });
    }

    const userId = actor.type === "user" ? actor.userId : (actor.type === "admin" ? actor.userId : null);

    // If it's a Vercel Blob or other supported storage, use getGatedBlobResponse
    // Otherwise, we might want to redirect if it's already a public allowed URL
    // but streaming ensures we don't leak upstream hosts that Next Image config might block.
    // However, if it's already public and allowed, redirect is more efficient.

    return getGatedBlobResponse(userId, video.id, thumbnailUrl, req.headers);
  } catch (error) {
    scopedLogger.error("[THUMBNAIL_PROXY_ERROR]", error);
    return handleApiError(error);
  }
}
