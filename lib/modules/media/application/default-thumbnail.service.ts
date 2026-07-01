import { prisma } from "@/lib/prisma";
import { getBlobAccess } from "@/lib/blob-config";
import { flags } from "@/lib/feature-flags";

const SETTING_KEY = "default_video_thumbnail";
const DEFAULT_THUMBNAIL_PROXY = "/api/admin/settings/media/default-video-thumbnail/proxy";

type CachedEntry = { url: string | null; fromCreator: boolean };
let cached: CachedEntry | undefined = undefined;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

async function resolveDefaultThumbnailEntry(): Promise<CachedEntry> {
  const now = Date.now();
  if (cached !== undefined && now < cacheExpiresAt) return cached;

  // Creator.defaultThumbnailUrl takes precedence over AppSetting blob upload
  const mainCreatorSlug = flags.mainCreatorSlug;
  if (mainCreatorSlug) {
    const creator = await prisma.creator.findUnique({ where: { slug: mainCreatorSlug }, select: { defaultThumbnailUrl: true } }).catch(() => null);
    if (creator?.defaultThumbnailUrl) {
      cached = { url: creator.defaultThumbnailUrl, fromCreator: true };
      cacheExpiresAt = now + CACHE_TTL_MS;
      return cached;
    }
  }

  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
  cached = { url: setting?.value ?? null, fromCreator: false };
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cached;
}

export async function resolveVideoThumbnailUrl(thumbnailUrl: string | null | undefined): Promise<string | null> {
  if (thumbnailUrl) return thumbnailUrl;

  const entry = await resolveDefaultThumbnailEntry();
  if (!entry.url) return null;

  // Creator.defaultThumbnailUrl is a direct external URL, no proxy needed
  if (entry.fromCreator) return entry.url;

  const access = getBlobAccess();
  return access === "private" ? DEFAULT_THUMBNAIL_PROXY : entry.url;
}

export function invalidateDefaultThumbnailCache() {
  cached = undefined;
  cacheExpiresAt = 0;
}
