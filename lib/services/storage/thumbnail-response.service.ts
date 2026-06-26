import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MediaPolicy } from "@/lib/modules/media";
import { logger } from "@/lib/logger";

export class ThumbnailResponseService {
  static async getThumbnailResponse(
    videoId: string,
    thumbnailUrl: string,
    headers?: Headers
  ): Promise<NextResponse> {
    // 1. Validate the host using existing MediaPolicy
    if (!MediaPolicy.isAllowedThumbnailUrl(thumbnailUrl, process.env)) {
      logger.warn("[ThumbnailResponseService] Blocked unauthorized thumbnail host", { videoId, thumbnailUrl });
      return new NextResponse("Unauthorized Thumbnail Host", { status: 403 });
    }

    try {
      // 2. Identify Vercel Blob URLs
      if (this.isVercelBlobUrl(thumbnailUrl)) {
        // For Vercel Blob (even if private), use backend access to get the stream
        try {
          // Use get() with private access to retrieve the authenticated stream directly
          const result = await get(thumbnailUrl, { access: "private" });

          if (!result) {
            return new NextResponse("Thumbnail not found in storage", { status: 404 });
          }

          const resHeaders = new Headers();
          result.headers.forEach((value, key) => {
            resHeaders.set(key, value);
          });
          resHeaders.set("Cache-Control", "public, max-age=3600");

          // For 200 responses, result.stream contains the blob content.
          // For 304, result.stream is null, which is correct for NextResponse.
          return new NextResponse(result.stream, {
            status: result.statusCode,
            headers: resHeaders,
          });
        } catch (error) {
          logger.error("[ThumbnailResponseService] Vercel Blob fetch failed", { videoId, error });
          return new NextResponse("Internal Storage Error", { status: 502 });
        }
      }

      // 3. For other allowed external URLs, we can either redirect or proxy.
      // Redirecting is more efficient and safe since we already validated the host.
      return NextResponse.redirect(thumbnailUrl);

    } catch (error) {
      logger.error("[ThumbnailResponseService] Unexpected error", { videoId, error });
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  }

  private static isVercelBlobUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.endsWith(".public.blob.vercel-storage.com");
    } catch {
      return false;
    }
  }
}
