import { NextRequest, NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { authorize } from "@/lib/modules/authz";
import {
  ThumbnailResponseService,
  PUBLIC_THUMBNAIL_CACHE_CONTROL,
  PRIVATE_THUMBNAIL_CACHE_CONTROL,
} from "@/lib/modules/media";
import { resolveVideoThumbnailUrl } from "@/lib/modules/media";
import { isVideoPubliclyVisible } from "@/lib/modules/video";

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
      select: {
        id: true,
        thumbnailUrl: true,
        status: true,
        publishedAt: true,
        moderationStatus: true,
        creator: { select: { status: true, deletedAt: true } },
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    // 2. Thumbnail Access Policy
    // - Published and unlisted videos that are due, not removed and on a visible channel: thumbnails are public
    //   (regardless of patron-only playback).
    // - Drafts/Archived/Unpublished: platform staff and members of the video's
    //   channel whose role allows `video.preview` (CLAUDE.md 4.23); nobody else.
    // An unlisted video is reachable by link, so its cover is too (it is never copied to the public bucket).
    // Public means what the link rules say (audit S05): due, not removed by moderation, on a publicly visible channel.
    const isPublic = isVideoPubliclyVisible(video);
    let mayPreview = false;
    if (!isPublic) {
      if (actor.type === "admin") {
        mayPreview = true;
      } else if (actor.type !== "guest") {
        mayPreview = (await authorize(ctx, "video.preview", { videoId: video.id })) === null;
      }
    }

    if (!isPublic && !mayPreview) {
      return NextResponse.json({ error: "Forbidden: Video is not public" }, { status: 403 });
    }

    // A stored thumbnailUrl that points back at this same proxy path (bad legacy
    // data, or a manual paste) would redirect to itself forever below. Treat it
    // as absent so it falls back to the global default instead of looping.
    const isSelfReferentialProxyPath = new RegExp(`^/api/videos/${video.id}/thumbnail(?:[/?].*)?$`).test(video.thumbnailUrl ?? "");
    const rawThumbnailUrl = isSelfReferentialProxyPath ? null : video.thumbnailUrl;

    // 3. Resolve thumbnail URL, falling back to global default if not set
    const resolvedUrl = await resolveVideoThumbnailUrl(rawThumbnailUrl);
    if (!resolvedUrl) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    // Relative URLs (legacy values like "/logo.png") are same-origin public
    // assets — redirect instead of server-side fetching, which cannot resolve
    // a relative URL.
    if (resolvedUrl.startsWith("/")) {
      return NextResponse.redirect(new URL(resolvedUrl, req.nextUrl.origin), 307);
    }

    // 4. Delegate to ThumbnailResponseService to handle storage streaming/redirect.
    // Published thumbnails may be CDN-cached (same bytes for everyone); drafts
    // are for staff and channel members only and must stay private so the CDN never serves them to guests.
    return ThumbnailResponseService.getThumbnailResponse(
      video.id,
      resolvedUrl,
      isPublic ? PUBLIC_THUMBNAIL_CACHE_CONTROL : PRIVATE_THUMBNAIL_CACHE_CONTROL,
    );

  } catch (error) {
    scopedLogger.error("[THUMBNAIL_PROXY_ERROR]", error);
    return handleApiError(error);
  }
}
