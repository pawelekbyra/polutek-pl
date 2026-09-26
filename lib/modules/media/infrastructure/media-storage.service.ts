import { del } from "@vercel/blob";
import { MediaPolicy } from "../domain/media.policy";
import { MediaHostEnv } from "../domain/media-safety";
import { parsePrivateThumbnailStorageUrl } from "../domain/r2-thumbnail";
import { R2ThumbnailStorageClient } from "./r2-thumbnail-storage.client";

export class MediaStorageService {
  /**
   * Deletes a replaced thumbnail if it lives in storage we own: the private R2
   * thumbnail bucket or Vercel Blob. Anything else (external hosts) is left alone.
   */
  static async deleteOwnedThumbnail(url: string): Promise<boolean> {
    if (!url) return false;

    const r2Key = parsePrivateThumbnailStorageUrl(url, process.env as MediaHostEnv);
    if (r2Key) {
      try {
        await new R2ThumbnailStorageClient().deletePrivate(r2Key);
        return true;
      } catch (error) {
        console.error("[MediaStorageService] Failed to delete R2 thumbnail:", r2Key, error);
        return false;
      }
    }

    return this.deleteOwnedBlob(url);
  }

  static async deleteOwnedBlob(url: string): Promise<boolean> {
    if (!url) return false;

    // Check if it's a Vercel Blob URL and if it's actually allowed (owned) by our config.
    // MediaPolicy.isAllowedMediaUrl checks against NEXT_PUBLIC_BLOB_PUBLIC_HOST
    if (!MediaPolicy.isAllowedMediaUrl(url, process.env as MediaHostEnv)) {
      return false;
    }

    try {
      await del(url);
      return true;
    } catch (error) {
      // Log error but don't fail the whole operation
      console.error("[MediaStorageService] Failed to delete blob:", url, error);
      return false;
    }
  }
}
