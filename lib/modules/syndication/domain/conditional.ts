/**
 * HTTP conditional requests for the feed (RFC 9110 section 13): `If-None-Match` wins over `If-Modified-Since`.
 * Pure, so the route stays a thin shell.
 */

function stripWeak(tag: string): string {
  return tag.trim().replace(/^W\//, "");
}

export function isNotModified(
  request: { ifNoneMatch?: string | null; ifModifiedSince?: string | null },
  current: { etag: string; lastModified: Date },
): boolean {
  if (request.ifNoneMatch) {
    const wanted = request.ifNoneMatch.split(",").map(stripWeak);
    return wanted.includes("*") || wanted.includes(stripWeak(current.etag));
  }
  if (request.ifModifiedSince) {
    const since = Date.parse(request.ifModifiedSince);
    // HTTP dates have whole-second precision.
    return Number.isFinite(since) && Math.floor(current.lastModified.getTime() / 1000) * 1000 <= since;
  }
  return false;
}
