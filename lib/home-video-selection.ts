/**
 * Which video the home page plays for `?v=<id or slug>`. Pure and safe for the client (no I/O, no imports), shared by
 * the server page, the metadata and ChannelHome so every one of them agrees.
 *
 * Order: a video of the home list (sidebar of the main channel) -> one extra video loaded by the server for a
 * link that points outside that list (another channel, or not in the sidebar; already checked for public
 * visibility) -> the hero. A video the viewer must not see is never loaded, so it falls through to the hero
 * exactly like an id that does not exist (no information about its existence).
 */
export type SelectableVideo = { id: string; slug: string };

export function pickHomeVideo<T extends SelectableVideo>(
  idOrSlug: string | undefined | null,
  pools: { allVideos: readonly T[]; mainVideo: T | null; extraVideo?: T | null },
): T | null {
  if (!idOrSlug) return pools.mainVideo;
  const fromList = pools.allVideos.find((v) => v.id === idOrSlug || v.slug === idOrSlug);
  if (fromList) return fromList;
  const extra = pools.extraVideo;
  if (extra && (extra.id === idOrSlug || extra.slug === idOrSlug)) return extra;
  return pools.mainVideo;
}

/** True when `?v=` names something the home list does not contain, so the server has to look it up itself. */
export function needsExtraVideoLookup(idOrSlug: string | undefined | null, allVideos: readonly SelectableVideo[]): boolean {
  if (!idOrSlug) return false;
  return !allVideos.some((v) => v.id === idOrSlug || v.slug === idOrSlug);
}
