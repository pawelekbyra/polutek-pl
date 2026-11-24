/** Object keys and content types of the own-HLS pipeline (see docs/architecture/self-hosted-hls.md). */

export const DEFAULT_HLS_BUCKET = "polutek-hls";

/** "videos/<videoId>/v/v<version>": also the VideoAsset.objectKey of a SELF_HLS asset. */
export function hlsAssetKey(videoId: string, versionNumber: number): string {
  return `videos/${videoId}/v/v${versionNumber}`;
}

/** Each newly claimed attempt owns a private output prefix; null maps pre-migration in-flight jobs. */
export function hlsAttemptAssetKey(videoId: string, versionNumber: number, attemptId: string | null | undefined): string {
  const generationKey = hlsAssetKey(videoId, versionNumber);
  return attemptId ? `${generationKey}/attempts/${attemptId}` : generationKey;
}

export function hlsObjectKey(videoId: string, versionNumber: number, relativePath: string): string {
  return `${hlsAssetKey(videoId, versionNumber)}/${relativePath.replace(/^\/+/, "")}`;
}

export function hlsAttemptObjectKey(videoId: string, versionNumber: number, attemptId: string | null | undefined, relativePath: string): string {
  return `${hlsAttemptAssetKey(videoId, versionNumber, attemptId)}/${relativePath.replace(/^\/+/, "")}`;
}

export function isHlsAssetKey(videoId: string, key: string): boolean {
  const prefix = `videos/${videoId}/v/v`;
  return key.startsWith(prefix) && /^\d+(?:\/attempts\/[0-9a-f-]{36})?$/.test(key.slice(prefix.length));
}

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};

export function hlsContentType(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return (dot >= 0 && CONTENT_TYPES[fileName.slice(dot).toLowerCase()]) || "application/octet-stream";
}

/** Files that stay on the server and are never uploaded (meta.json holds local timings). */
export function isUploadableHlsFile(relativePath: string): boolean {
  return !relativePath.endsWith("meta.json") && !relativePath.includes(".probe");
}

/** The master playlist is uploaded LAST: until it exists, nothing of the output is reachable. */
export function sortForUpload(relativePaths: string[]): string[] {
  const rest = relativePaths.filter((p) => p !== "master.m3u8");
  const master = relativePaths.filter((p) => p === "master.m3u8");
  return [...rest, ...master];
}
