import { prisma } from "@/lib/prisma";
import { flags } from "@/lib/feature-flags";

const SETTING_KEY = "default_video_thumbnail";

let cached: string | null | undefined = undefined;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

async function resolveDefaultThumbnailUrl(): Promise<string | null> {
  const now = Date.now();
  if (cached !== undefined && now < cacheExpiresAt) return cached;

  // Creator.defaultThumbnailUrl takes precedence over AppSetting blob upload
  const mainCreatorSlug = flags.mainCreatorSlug;
  if (mainCreatorSlug) {
    const creator = await prisma.creator.findUnique({ where: { slug: mainCreatorSlug }, select: { defaultThumbnailUrl: true } }).catch(() => null);
    if (creator?.defaultThumbnailUrl) {
      cached = creator.defaultThumbnailUrl;
      cacheExpiresAt = now + CACHE_TTL_MS;
      return cached;
    }
  }

  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
  cached = setting?.value ?? null;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cached;
}

// Returns the raw storage/external URL. Callers stream it server-side via
// ThumbnailResponseService (which handles private Vercel Blob access), so a
// relative proxy path must never be returned here — server-side fetch of a
// relative URL fails.
export async function resolveVideoThumbnailUrl(thumbnailUrl: string | null | undefined): Promise<string | null> {
  if (thumbnailUrl) return thumbnailUrl;
  return resolveDefaultThumbnailUrl();
}

export function invalidateDefaultThumbnailCache() {
  cached = undefined;
  cacheExpiresAt = 0;
}
