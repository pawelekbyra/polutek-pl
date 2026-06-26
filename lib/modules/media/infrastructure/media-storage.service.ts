import { del } from "@vercel/blob";
import { MediaPolicy } from "../domain/media.policy";

export class MediaStorageService {
  static async deleteOwnedBlob(url: string): Promise<boolean> {
    if (!url) return false;

    // Check if it's a Vercel Blob URL and if it's actually allowed (owned) by our config.
    // MediaPolicy.isAllowedMediaUrl checks against NEXT_PUBLIC_BLOB_PUBLIC_HOST
    if (!MediaPolicy.isAllowedMediaUrl(url, process.env as any)) {
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
