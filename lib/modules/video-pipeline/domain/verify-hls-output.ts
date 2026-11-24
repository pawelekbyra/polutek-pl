import path from "node:path";

export interface HlsOutputVerification {
  complete: boolean;
  objectCount: number;
  reason: string | null;
}

/** Checks the playlists' referenced graph against a prefix listing before a retry reuses a DB route. */
export async function verifyHlsOutput(
  prefix: string,
  objectKeys: string[],
  readText: (key: string) => Promise<string | null>,
): Promise<HlsOutputVerification> {
  const root = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const objects = new Set(objectKeys);
  const masterKey = `${root}master.m3u8`;
  if (!objects.has(masterKey)) return { complete: false, objectCount: objects.size, reason: "master.m3u8 is missing" };

  const pending = [masterKey];
  const visited = new Set<string>();
  let referencedMedia = 0;
  while (pending.length > 0) {
    const playlistKey = pending.pop()!;
    if (visited.has(playlistKey)) continue;
    visited.add(playlistKey);
    const source = await readText(playlistKey);
    if (source === null) return { complete: false, objectCount: objects.size, reason: `playlist is unreadable: ${playlistKey}` };

    const uris = playlistUris(source);
    if (uris.length === 0) return { complete: false, objectCount: objects.size, reason: `playlist has no references: ${playlistKey}` };
    for (const uri of uris) {
      const target = resolveRelativeKey(root, playlistKey, uri);
      if (!target) return { complete: false, objectCount: objects.size, reason: `playlist has an unsafe reference: ${uri}` };
      if (!objects.has(target)) return { complete: false, objectCount: objects.size, reason: `referenced object is missing: ${target}` };
      if (target.toLowerCase().endsWith(".m3u8")) pending.push(target);
      else if (/\.(?:m4s|m4v|mp4|ts|aac|mp3)$/i.test(target)) referencedMedia += 1;
    }
  }

  if (referencedMedia === 0) return { complete: false, objectCount: objects.size, reason: "playlists reference no media segments" };
  return { complete: true, objectCount: objects.size, reason: null };
}

function playlistUris(source: string): string[] {
  const uris: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith("#")) {
      uris.push(trimmed);
      continue;
    }
    for (const match of trimmed.matchAll(/URI="([^"]+)"/g)) uris.push(match[1]);
  }
  return uris;
}

function resolveRelativeKey(root: string, playlistKey: string, uri: string): string | null {
  if (!uri || uri.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(uri)) return null;
  const withoutQuery = uri.split(/[?#]/, 1)[0];
  const relativePlaylist = playlistKey.slice(root.length);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relativePlaylist), withoutQuery));
  if (!resolved || resolved === "." || resolved === ".." || resolved.startsWith("../")) return null;
  return `${root}${resolved}`;
}
