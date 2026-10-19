/**
 * Pure rules of playlists (docs/architecture/playlists.md): limits, slugs and the reorder check. No I/O, so the
 * use cases, the Studio form and the tests share one definition.
 */

export const PLAYLIST_VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
export type PlaylistVisibilityValue = (typeof PLAYLIST_VISIBILITIES)[number];

export const PLAYLIST_TITLE_MAX = 100;
export const PLAYLIST_DESCRIPTION_MAX = 1000;
/** A playlist holds at most this many videos (one queue panel, one atomic reorder). */
export const PLAYLIST_ITEMS_MAX = 200;
/** A channel keeps at most this many (non-deleted) playlists. */
export const PLAYLISTS_PER_CHANNEL_MAX = 100;
export const PLAYLIST_SLUG_MAX = 60;

export function isPlaylistVisibility(value: unknown): value is PlaylistVisibilityValue {
  return typeof value === "string" && (PLAYLIST_VISIBILITIES as readonly string[]).includes(value);
}

/** ASCII slug of a title: diacritics folded (Polish ł included), anything else becomes "-". Never empty. */
export function slugifyPlaylistTitle(title: string): string {
  const folded = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/gi, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PLAYLIST_SLUG_MAX)
    .replace(/-+$/g, "");
  return folded || "playlist";
}

/** `base`, or `base-2`, `base-3`, ... until it is not in `taken` (soft-deleted playlists keep their slug taken). */
export function pickUniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, PLAYLIST_SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 40)}-${Date.now().toString(36)}`;
}

export type ReorderCheck =
  | { ok: true; assignments: { videoId: string; position: number }[] }
  | { ok: false; reason: "DUPLICATE" | "MISMATCH" | "TOO_MANY" };

/**
 * A reorder is the WHOLE new order: exactly the videos the playlist holds now, each once. Anything else (a missing,
 * an extra or a repeated id, i.e. a stale client) is refused and nothing is written. Positions become 0..n-1.
 */
export function validateReorder(currentVideoIds: readonly string[], requested: readonly string[]): ReorderCheck {
  if (requested.length > PLAYLIST_ITEMS_MAX) return { ok: false, reason: "TOO_MANY" };
  if (new Set(requested).size !== requested.length) return { ok: false, reason: "DUPLICATE" };
  if (requested.length !== currentVideoIds.length) return { ok: false, reason: "MISMATCH" };
  const current = new Set(currentVideoIds);
  if (requested.some((id) => !current.has(id))) return { ok: false, reason: "MISMATCH" };
  return { ok: true, assignments: requested.map((videoId, position) => ({ videoId, position })) };
}

/** Moves one entry by `delta` places (clamped); the Studio's up/down buttons use it. Returns a new array. */
export function moveItem<T>(items: readonly T[], from: number, delta: number): T[] {
  const to = Math.max(0, Math.min(items.length - 1, from + delta));
  const next = [...items];
  if (from < 0 || from >= items.length || to === from) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
