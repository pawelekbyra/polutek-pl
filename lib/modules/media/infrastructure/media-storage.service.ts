import type { MediaHostEnv } from "../domain/media-safety";
import { parsePrivateThumbnailStorageUrl } from "../domain/r2-thumbnail";
import { R2ThumbnailStorageClient } from "./r2-thumbnail-storage.client";

export class MediaStorageService {
  /**
   * Deletes a replaced thumbnail if it lives in storage we own: the private R2
   * thumbnail bucket. Anything else (external hosts) is left alone.
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

    return false;
  }
}
