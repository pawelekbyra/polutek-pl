/**
 * Scheduled premieres (see CLAUDE.md "Premieres").
 *
 * A video is an *upcoming premiere* iff it is PUBLISHED and its `premiereAt`
 * is still in the future. This is evaluated at read time — there is no cron
 * and no extra status: the moment `premiereAt` passes, every read path
 * (sidebar, playback plan, public DTOs) treats it as an ordinary video.
 *
 * Pure and dependency-free on purpose: it is used by server code (playback
 * gate, sidebar layout) and by client components (via `lib/premiere.ts`).
 * Every premiere check must go through this helper — never compare
 * `premiereAt` with the clock by hand.
 */
export type PremiereCandidate = {
  status?: string | null;
  premiereAt?: Date | string | null;
};

export function toPremiereDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The date viewers should see as "published": the later of the stored
 * `publishedAt` and `premiereAt`. The stored `publishedAt` is deliberately
 * NOT moved to the premiere time — every public query treats a future
 * `publishedAt` as "hidden", which would hide the upcoming video from the
 * "Coming soon" section and from checkVideoAccess(). Public DTOs and sidebar
 * ordering use this instead, so "x ago" and ordering start at the premiere.
 */
export function effectivePublishedAt(video: {
  publishedAt?: Date | string | null;
  premiereAt?: Date | string | null;
}): Date | null {
  const published = toPremiereDate(video.publishedAt);
  const premiere = toPremiereDate(video.premiereAt);
  if (!published) return premiere;
  if (!premiere) return published;
  return premiere.getTime() > published.getTime() ? premiere : published;
}

/**
 * Admin rule: a premiere that is newly set (or moved) must be in the future.
 * `null`/`undefined` (publish now / untouched) is always fine, and so is
 * resubmitting the stored value unchanged — the edit form sends every field
 * back on each save, even after the premiere has passed.
 */
export function isAllowedPremiereChange(
  next: Date | null | undefined,
  existing: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (next === undefined || next === null) return true;
  if (Number.isNaN(next.getTime())) return false;
  const previous = toPremiereDate(existing);
  if (previous && previous.getTime() === next.getTime()) return true;
  return next.getTime() > now.getTime();
}

/**
 * `status` is optional so public DTOs (which only ever contain PUBLISHED
 * videos and don't carry a status) can use the same helper; when a status is
 * given, anything other than PUBLISHED is never "upcoming" (drafts stay
 * drafts, archived stays archived).
 */
export function isUpcomingPremiere(video: PremiereCandidate | null | undefined, now: Date = new Date()): boolean {
  if (!video) return false;
  if (video.status !== undefined && video.status !== null && video.status !== "PUBLISHED") return false;
  const premiereAt = toPremiereDate(video.premiereAt);
  return premiereAt !== null && premiereAt.getTime() > now.getTime();
}
