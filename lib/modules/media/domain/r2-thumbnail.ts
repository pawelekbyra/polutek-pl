import { MediaHostEnv, parseMediaHosts } from './media-safety';

// Thumbnails live in two R2 buckets:
//
// - a PRIVATE bucket that receives every admin upload (drafts included). It is
//   only reachable through the authenticated S3 API, so the value stored in
//   `Video.thumbnailUrl` is the S3-endpoint URL of the object — absolute (so
//   `resolveVideoThumbnailUrl()` can hand it to server-side streaming) but not
//   fetchable without credentials, exactly like a private Vercel Blob URL.
// - a PUBLIC bucket (custom domain / r2.dev, `NEXT_PUBLIC_R2_PUBLIC_HOST`) that
//   only ever holds copies of PUBLISHED videos' thumbnails, under the same
//   content-hashed key. `Video.thumbnailPublicUrl` records the copy.
//
// Drafts therefore never have a public-bucket copy; see
// `lib/modules/video/application/sync-public-thumbnail.service.ts`.

/** Content-hashed keys never change content, so browsers/CDN may cache forever. */
export const R2_PUBLIC_THUMBNAIL_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export const THUMBNAIL_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface R2ThumbnailConfig {
  accountId: string | null;
  privateBucket: string | null;
  publicBucket: string | null;
  publicHost: string | null;
}

export function getR2ThumbnailConfig(env: MediaHostEnv): R2ThumbnailConfig {
  return {
    accountId: env.CLOUDFLARE_R2_ACCOUNT_ID?.trim() || null,
    privateBucket: env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE?.trim() || null,
    publicBucket: env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC?.trim() || null,
    publicHost: parseMediaHosts(env.NEXT_PUBLIC_R2_PUBLIC_HOST)[0] ?? null,
  };
}

/**
 * `scope` is a path prefix such as `videos/<videoId>` or `settings/default-video-thumbnail`.
 * The file name is the SHA-256 of the bytes, so a key never points at different content.
 */
export function buildThumbnailObjectKey(scope: string, contentHash: string, extension: string): string {
  const safeScope = scope
    .split('/')
    .map((segment) => segment.replace(/[^A-Za-z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/');
  return `${safeScope}/${contentHash.toLowerCase()}.${extension}`;
}

export function buildPrivateThumbnailStorageUrl(accountId: string, bucket: string, key: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
}

export function buildPublicThumbnailUrl(publicHost: string, key: string): string {
  return `https://${publicHost}/${key}`;
}

function parseHttpsUrl(rawUrl: string | null | undefined): URL | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function isSafeObjectKey(key: string): boolean {
  return key.length > 0 && !key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
}

/** Returns the object key when `rawUrl` points into our private thumbnail bucket, else null. */
export function parsePrivateThumbnailStorageUrl(rawUrl: string | null | undefined, env: MediaHostEnv): string | null {
  const { accountId, privateBucket } = getR2ThumbnailConfig(env);
  if (!accountId || !privateBucket) return null;

  const url = parseHttpsUrl(rawUrl);
  if (!url || url.search || url.hash) return null;
  if (url.hostname.toLowerCase() !== `${accountId.toLowerCase()}.r2.cloudflarestorage.com`) return null;

  const prefix = `/${privateBucket}/`;
  if (!url.pathname.startsWith(prefix)) return null;

  const key = decodeURIComponent(url.pathname.slice(prefix.length));
  return isSafeObjectKey(key) ? key : null;
}

/** Returns the object key when `rawUrl` points at our public thumbnail host, else null. */
export function parsePublicThumbnailUrl(rawUrl: string | null | undefined, env: MediaHostEnv): string | null {
  const { publicHost } = getR2ThumbnailConfig(env);
  if (!publicHost) return null;

  const url = parseHttpsUrl(rawUrl);
  if (!url || url.search || url.hash) return null;
  if (url.hostname.toLowerCase() !== publicHost) return null;

  const key = decodeURIComponent(url.pathname.slice(1));
  return isSafeObjectKey(key) ? key : null;
}

export interface PublicThumbnailSourceInput {
  id: string;
  status?: string | null;
  thumbnailUrl?: string | null;
  thumbnailPublicUrl?: string | null;
}

/**
 * The thumbnail `src` to put in a public DTO. A published video whose public
 * R2 copy matches its current private thumbnail is served straight from R2;
 * everything else (drafts, Blob/legacy thumbnails, default fallback, a copy
 * not synced yet) goes through `/api/videos/[id]/thumbnail`, which enforces
 * the admin-only draft policy server-side.
 */
export function resolvePublicThumbnailSrc(video: PublicThumbnailSourceInput, env: MediaHostEnv): string {
  const proxyPath = `/api/videos/${video.id}/thumbnail`;
  if (video.status !== 'PUBLISHED') return proxyPath;

  const publicKey = parsePublicThumbnailUrl(video.thumbnailPublicUrl, env);
  if (!publicKey) return proxyPath;

  const privateKey = parsePrivateThumbnailStorageUrl(video.thumbnailUrl, env);
  if (privateKey !== publicKey) return proxyPath;

  return video.thumbnailPublicUrl as string;
}
