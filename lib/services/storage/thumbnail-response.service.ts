import { get, head } from "@vercel/blob";
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
      const isVercelBlob = this.isVercelBlobUrl(thumbnailUrl);

      if (isVercelBlob) {
        // For Vercel Blob (even if private), try to get it using backend credentials
        try {
          const blobMetadata = await head(thumbnailUrl);
          if (!blobMetadata) {
            return new NextResponse("Thumbnail not found in storage", { status: 404 });
          }

          const response = await fetch(thumbnailUrl);

          if (!response.ok) {
            return new NextResponse("Error fetching thumbnail from storage", { status: 502 });
          }

          const resHeaders = new Headers();
          ["Content-Type", "Content-Length"].forEach((h) => {
            const val = response.headers.get(h);
            if (val) resHeaders.set(h, val);
          });
          resHeaders.set("Cache-Control", "public, max-age=3600");

          return new NextResponse(response.body, {
            status: 200,
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
