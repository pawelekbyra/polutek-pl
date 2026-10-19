import { PLAYLIST_ITEMS_MAX } from "./playlist-rules";

/**
 * The playlist context of the watch page: `?list=<playlist slug>&i=<n>` (n is the 1-based place in the list the
 * viewer sees). The server is the authority on where a video really sits: `i` is only a hint and a wrong or missing
 * one never breaks anything (`locateInQueue` looks the video up by id).
 */

export const PLAYLIST_LIST_PARAM = "list";
export const PLAYLIST_INDEX_PARAM = "i";

/** A usable `?list=` value: a playlist slug (lowercase ASCII, digits, dashes), never empty or absurdly long. */
export function parseListParam(raw: string | string[] | null | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(trimmed) ? trimmed : null;
}

/** 1-based index from `?i=`; null for anything that is not a whole number in 1..PLAYLIST_ITEMS_MAX. */
export function parseQueueIndex(raw: string | string[] | null | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !/^\d{1,4}$/.test(value.trim())) return null;
  const n = Number.parseInt(value, 10);
  return n >= 1 && n <= PLAYLIST_ITEMS_MAX ? n : null;
}

export type QueuePosition = { index: number; previousId: string | null; nextId: string | null };

/** Where `currentId` sits in the visible queue (0-based `index`, -1 when absent) and its neighbours. */
export function locateInQueue(videoIds: readonly string[], currentId: string | null | undefined): QueuePosition {
  const index = currentId ? videoIds.indexOf(currentId) : -1;
  if (index < 0) return { index: -1, previousId: null, nextId: null };
  return { index, previousId: videoIds[index - 1] ?? null, nextId: videoIds[index + 1] ?? null };
}

/** Query string of one entry of a playlist on the watch page (`?v=<video slug>&list=<slug>&i=<n>`). */
export function buildWatchQuery(videoSlug: string, listSlug: string, oneBasedIndex: number): string {
  return `v=${encodeURIComponent(videoSlug)}&${PLAYLIST_LIST_PARAM}=${encodeURIComponent(listSlug)}&${PLAYLIST_INDEX_PARAM}=${oneBasedIndex}`;
}
