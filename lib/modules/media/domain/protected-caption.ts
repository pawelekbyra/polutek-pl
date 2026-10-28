/**
 * Captions (WebVTT) are private files of the HLS bucket, never public objects (audit W01, S10).
 *
 * - Object key (bucket `polutek-hls`, written by the panel): `videos/<videoId>/captions/<lang>-<sha256>.vtt`.
 *   The name is content-hashed, so a key never points at different content. It sits next to, not inside,
 *   the HLS versions (`videos/<id>/v/v<N>/`), so a re-encode or deleting a version leaves captions alone.
 * - Stored value (`Video.subtitleUrlPl/En`, `VideoTranslation.subtitleUrl`): a reference `hlscap:<lang>-<sha256>.vtt`,
 *   not a URL. It is not fetchable by itself; the playback plan turns it into a delivery URL
 *   `<base>/h/<token>/<videoId>/<version>/captions/<file>` with the SAME token as the video, only after
 *   the access decision (CLAUDE.md 4.7). An old app that does not know the prefix drops such a track.
 * - The Worker (`workers/hls-edge/worker.mjs`) mirrors the file-name rule and the key layout.
 *
 * Values that are not references (an https URL of the old public bucket, a same-site path) still work as before.
 */

export const CAPTION_REF_PREFIX = 'hlscap:';
/** Same default as `DEFAULT_HLS_BUCKET` in video-pipeline (a test keeps them equal). */
export const CAPTION_DEFAULT_BUCKET = 'polutek-hls';

const FILE_RE = /^([a-z]{2,8})-([0-9a-f]{64})\.vtt$/;
const VIDEO_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export type ParsedCaptionRef = { file: string; lang: string; hash: string };

/** `<lang>-<sha256>.vtt` */
export function captionFileName(lang: string, contentHash: string): string {
  const file = `${lang}-${contentHash.toLowerCase()}.vtt`;
  if (!FILE_RE.test(file)) throw new Error('Invalid caption language or hash');
  return file;
}

export function parseCaptionFileName(file: string): ParsedCaptionRef | null {
  const m = FILE_RE.exec(file);
  return m ? { file, lang: m[1], hash: m[2] } : null;
}

export function formatCaptionRef(file: string): string {
  if (!FILE_RE.test(file)) throw new Error('Invalid caption file name');
  return `${CAPTION_REF_PREFIX}${file}`;
}

/** The reference stored in a subtitle column, or null for anything else (URL, path, empty, malformed). */
export function parseCaptionRef(value: string | null | undefined): ParsedCaptionRef | null {
  if (typeof value !== 'string' || !value.startsWith(CAPTION_REF_PREFIX)) return null;
  return parseCaptionFileName(value.slice(CAPTION_REF_PREFIX.length));
}

/** Key in the HLS bucket. */
export function captionObjectKey(videoId: string, file: string): string {
  if (!VIDEO_ID_RE.test(videoId) || !FILE_RE.test(file)) throw new Error('Invalid caption key');
  return `videos/${videoId}/captions/${file}`;
}

/** Path below the token/video/version part of a delivery URL. */
export function captionDeliveryPath(file: string): string {
  if (!FILE_RE.test(file)) throw new Error('Invalid caption file name');
  return `captions/${file}`;
}

/** True only for a key of exactly this video's caption layout (what the clean-up job may delete). */
export function isCaptionKeyOf(videoId: string, key: string): boolean {
  const prefix = `videos/${videoId}/captions/`;
  return VIDEO_ID_RE.test(videoId) && key.startsWith(prefix) && FILE_RE.test(key.slice(prefix.length));
}
