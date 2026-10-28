import { NextResponse } from "next/server";
import { MediaPolicy } from "@/lib/modules/media";
import { parsePrivateThumbnailStorageUrl } from "../domain/r2-thumbnail";
import { R2ThumbnailStorageClient } from "./r2-thumbnail-storage.client";
import { logger } from "@/lib/logger";

// Published thumbnails are identical for every viewer, so the CDN may cache
// them (s-maxage). Draft thumbnails are admin-only and must never be CDN
// cached — a shared cached copy would leak them to anonymous visitors.
export const PUBLIC_THUMBNAIL_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
export const PRIVATE_THUMBNAIL_CACHE_CONTROL = "private, max-age=300";
export const DISABLED_THUMBNAIL_CACHE_CONTROL = "private, no-store";

function resolveThumbnailCacheControl(cacheControl: string) {
  if (process.env.DISABLE_PUBLIC_MEDIA_CACHE === "true") {
    return DISABLED_THUMBNAIL_CACHE_CONTROL;
  }

  return cacheControl;
}

export class ThumbnailResponseService {
  static async getThumbnailResponse(
    videoId: string,
    thumbnailUrl: string,
    cacheControl: string = PRIVATE_THUMBNAIL_CACHE_CONTROL
  ): Promise<NextResponse> {
    const effectiveCacheControl = resolveThumbnailCacheControl(cacheControl);
    try {
      // 1. Our private R2 thumbnail bucket — authenticated S3 read, never a plain fetch.
      const r2Key = parsePrivateThumbnailStorageUrl(thumbnailUrl, process.env);
      if (r2Key) {
        try {
          const object = await new R2ThumbnailStorageClient().getPrivate(r2Key);
          if (!object) {
            return new NextResponse("Thumbnail not found in storage", { status: 404 });
          }

          const resHeaders = new Headers();
          if (object.contentType) resHeaders.set("Content-Type", object.contentType);
          if (object.contentLength !== null) resHeaders.set("Content-Length", String(object.contentLength));
          if (object.etag) resHeaders.set("ETag", object.etag);
          resHeaders.set("Cache-Control", effectiveCacheControl);

          return new NextResponse(object.body, { status: 200, headers: resHeaders });
        } catch (error) {
          logger.error("[ThumbnailResponseService] R2 fetch failed", { videoId, error });
          return new NextResponse("Internal Storage Error", { status: 502 });
        }
      }

      // 2. For other external URLs, validate against MediaPolicy first
      if (!MediaPolicy.isAllowedThumbnailUrl(thumbnailUrl, process.env)) {
        logger.warn("[ThumbnailResponseService] Blocked unauthorized thumbnail host", { videoId, thumbnailUrl });
        return new NextResponse("Unauthorized Thumbnail Host", { status: 403 });
      }

      // 3. Stream external URL to avoid Next Image config restrictions
      try {
        const response = await fetch(thumbnailUrl);

        if (!response.ok) {
          return new NextResponse("Error fetching external thumbnail", { status: 502 });
        }

        if (!response.body) {
           logger.error("[ThumbnailResponseService] External response missing body", { videoId, thumbnailUrl });
           return new NextResponse("Thumbnail content unavailable", { status: 502 });
        }

        const resHeaders = new Headers();
        ["Content-Type", "Content-Length"].forEach((h) => {
          const val = response.headers.get(h);
          if (val) resHeaders.set(h, val);
        });
        // Always enforce our own caching policy — the external origin's
        // Cache-Control must not decide whether the CDN may cache a draft.
        resHeaders.set("Cache-Control", effectiveCacheControl);

        return new NextResponse(response.body, {
          status: 200,
          headers: resHeaders,
        });
      } catch (error) {
        logger.error("[ThumbnailResponseService] External fetch failed", { videoId, error });
        return new NextResponse("Gateway Error", { status: 502 });
      }

    } catch (error) {
      logger.error("[ThumbnailResponseService] Unexpected error", { videoId, error });
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  }

}
