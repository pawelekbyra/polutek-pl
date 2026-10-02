/**
 * @deprecated Compatibility layer over lib/modules/media (URL allow-list helpers).
 * The raw-video blob proxy that used to live here is gone: video is served only
 * by our own HLS (CLAUDE.md 4.17).
 */

import {
  MediaPolicy,
  MediaHostEnv,
  parseMediaHosts as _parseMediaHosts,
} from "@/lib/modules/media";

/** @deprecated Use MediaPolicy.getAllowedMediaHosts */
export function getAllowedMediaHosts(env: MediaHostEnv = process.env) {
  return MediaPolicy.getAllowedMediaHosts(env);
}

/** @deprecated Use parseMediaHosts from @/lib/modules/media */
export function parseMediaHosts(value?: string | null): string[] {
  return _parseMediaHosts(value);
}

/** @deprecated Use MediaPolicy.isAllowedMediaUrl */
export function isAllowedMediaUrl(
  rawUrl: string,
  env: MediaHostEnv = process.env,
) {
  return MediaPolicy.isAllowedMediaUrl(rawUrl, env);
}

/** @deprecated Use MediaPolicy.isAllowedThumbnailUrl */
export function isAllowedThumbnailUrl(
  rawUrl: string,
  env: MediaHostEnv = process.env,
) {
  return MediaPolicy.isAllowedThumbnailUrl(rawUrl, env);
}

/** @deprecated Use MediaPolicy.isAllowedAvatarUrl */
export function isAllowedAvatarUrl(
  rawUrl?: string | null,
  env: MediaHostEnv = process.env,
) {
  return MediaPolicy.isAllowedAvatarUrl(rawUrl, env);
}

/** @deprecated Use MediaPolicy.isAllowedCommentImageUrl */
export function isAllowedCommentImageUrl(
  rawUrl: string,
  env: MediaHostEnv = process.env,
) {
  return MediaPolicy.isAllowedCommentImageUrl(rawUrl, env);
}

export { isSafeLocalPath, isBlockedPrivateHostname } from "@/lib/modules/media";
