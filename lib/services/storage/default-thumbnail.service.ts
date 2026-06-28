import { prisma } from "@/lib/prisma";
import { getBlobAccess } from "@/lib/blob-config";

const SETTING_KEY = "default_video_thumbnail";
const DEFAULT_THUMBNAIL_PROXY = "/api/admin/settings/media/default-video-thumbnail/proxy";

let cachedDefaultThumbnail: string | null | undefined = undefined;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

async function getDefaultThumbnailStorageUrl(): Promise<string | null> {
  const now = Date.now();
  if (cachedDefaultThumbnail !== undefined && now < cacheExpiresAt) {
    return cachedDefaultThumbnail;
  }

  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
  cachedDefaultThumbnail = setting?.value ?? null;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedDefaultThumbnail;
}

export async function resolveVideoThumbnailUrl(thumbnailUrl: string | null | undefined): Promise<string | null> {
  if (thumbnailUrl) return thumbnailUrl;

  const storageUrl = await getDefaultThumbnailStorageUrl();
  if (!storageUrl) return null;

  const access = getBlobAccess();
  return access === "private" ? DEFAULT_THUMBNAIL_PROXY : storageUrl;
}

export function invalidateDefaultThumbnailCache() {
  cachedDefaultThumbnail = undefined;
  cacheExpiresAt = 0;
}
