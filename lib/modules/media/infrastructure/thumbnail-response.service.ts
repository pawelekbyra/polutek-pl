import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MediaPolicy } from "@/lib/modules/media";
import { logger } from "@/lib/logger";

export class ThumbnailResponseService {
  static async getThumbnailResponse(
    videoId: string,
    thumbnailUrl: string
  ): Promise<NextResponse> {
    try {
      // 1. Vercel Blob URLs (our own storage) are always trusted — no MediaPolicy needed
      if (this.isVercelBlobUrl(thumbnailUrl)) {
        // For Vercel Blob (even if private), use backend access to get the stream
        try {
          // Use get() with private access to retrieve the authenticated stream directly
          const result = await get(thumbnailUrl, { access: "private" });

          if (!result) {
            return new NextResponse("Thumbnail not found in storage", { status: 404 });
          }

          const resHeaders = new Headers();
          // Type-safe header transfer from undici Headers to standard Headers
          result.headers.forEach((value, key) => {
            resHeaders.set(key, value);
          });
          resHeaders.set("Cache-Control", "public, max-age=3600");

          if (result.statusCode === 304) {
            return new NextResponse(null, {
              status: 304,
              headers: resHeaders,
            });
          }

          if (!result.stream) {
            logger.error("[ThumbnailResponseService] Unexpected null stream for 200 response", { videoId });
            return new NextResponse("Thumbnail content unavailable", { status: 502 });
          }

          return new NextResponse(result.stream, {
            status: 200,
            headers: resHeaders,
          });
        } catch (error) {
          logger.error("[ThumbnailResponseService] Vercel Blob fetch failed", { videoId, error });
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
        ["Content-Type", "Content-Length", "Cache-Control"].forEach((h) => {
          const val = response.headers.get(h);
          if (val) resHeaders.set(h, val);
        });
        if (!resHeaders.has("Cache-Control")) {
           resHeaders.set("Cache-Control", "public, max-age=3600");
        }

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

  private static isVercelBlobUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname.endsWith(".blob.vercel-storage.com")) return true;
      const customHost = process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST;
      if (customHost) {
        const customHostname = new URL(customHost.startsWith('http') ? customHost : `https://${customHost}`).hostname.toLowerCase();
        return hostname === customHostname;
      }
      return false;
    } catch {
      return false;
    }
  }
}
