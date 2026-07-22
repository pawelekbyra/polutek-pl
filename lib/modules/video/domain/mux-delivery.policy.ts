/**
 * Delivery-cost guardrails for Mux playback. Mux delivery is billed pay-as-you-go per minute
 * streamed, so a sudden traffic spike (viral post, bot scraping, etc.) directly increases cost
 * with no natural ceiling. This module resolves the `max_resolution` query parameter appended to
 * every `stream.mux.com/{playbackId}.m3u8` URL, which caps which HLS renditions Mux advertises to
 * the player — capping resolution is the cheapest lever to pull under load, since a 1080p stream
 * costs roughly 2x-4x more to deliver than 480p for the same watch time.
 *
 * All of this is env-var driven so it can be tuned (or used as an emergency brake) from a Vercel
 * env var change alone, with no code deploy needed.
 */

const RESOLUTION_ORDER = ["240p", "360p", "480p", "540p", "720p", "1080p", "1440p", "2160p"] as const;

export type MuxResolution = (typeof RESOLUTION_ORDER)[number];

const DEFAULT_RESOLUTION: MuxResolution = "1080p";
const DEFAULT_ANONYMOUS_RESOLUTION: MuxResolution = "720p";
const DEFAULT_DEGRADED_RESOLUTION: MuxResolution = "480p";

function normalizeResolution(value: string | undefined | null, fallback: MuxResolution): MuxResolution {
  const trimmed = (value || "").trim().toLowerCase();
  return (RESOLUTION_ORDER as readonly string[]).includes(trimmed) ? (trimmed as MuxResolution) : fallback;
}

/** Returns whichever of the two resolutions is the more restrictive (lower quality). */
function stricterOf(a: MuxResolution, b: MuxResolution): MuxResolution {
  return RESOLUTION_ORDER.indexOf(a) <= RESOLUTION_ORDER.indexOf(b) ? a : b;
}

export interface ResolveMuxMaxResolutionInput {
  /** True for guest/anonymous viewers (no Clerk session). */
  isAnonymous: boolean;
  /** True when the global delivery circuit breaker has tripped (see mux-circuit-breaker.ts). */
  degraded: boolean;
}

/**
 * Resolves the `max_resolution` value for a Mux playback URL.
 *
 * - Signed-in/patron viewers get `MUX_MAX_RESOLUTION` (default 1080p).
 * - Anonymous viewers get the stricter of `MUX_MAX_RESOLUTION_ANONYMOUS` (default 720p) and the
 *   signed-in cap — anonymous viewers should never end up with a *higher* cap than everyone else
 *   just because of an env-var typo.
 * - If the global circuit breaker is tripped (see mux-circuit-breaker.ts), the result is further
 *   clamped down to `MUX_DEGRADED_MAX_RESOLUTION` (default 480p) for every viewer, regardless of
 *   tier — this is a soft, site-wide degrade, not a per-viewer one.
 *
 * Pure function, no I/O — keep it that way so it stays trivially testable.
 */
export function resolveMuxMaxResolution(input: ResolveMuxMaxResolutionInput): MuxResolution {
  const defaultResolution = normalizeResolution(process.env.MUX_MAX_RESOLUTION, DEFAULT_RESOLUTION);
  const anonymousResolution = normalizeResolution(process.env.MUX_MAX_RESOLUTION_ANONYMOUS, DEFAULT_ANONYMOUS_RESOLUTION);

  const base = input.isAnonymous ? stricterOf(anonymousResolution, defaultResolution) : defaultResolution;

  if (!input.degraded) return base;

  const degradedResolution = normalizeResolution(process.env.MUX_DEGRADED_MAX_RESOLUTION, DEFAULT_DEGRADED_RESOLUTION);
  return stricterOf(base, degradedResolution);
}

/**
 * Mux's `video_quality` asset setting controls the encoding tier (and therefore both encoding
 * cost and the max resolution Mux will ever produce for an asset, independent of delivery-time
 * restrictions). "basic" is free to encode and plenty for this catalogue's use case; it's set
 * explicitly here — rather than left to the Mux account's dashboard default — so a future,
 * unrelated dashboard change (e.g. someone bumping the account default to "plus" for a different
 * project) can't silently start billing us for pricier encodes.
 */
export const MUX_VIDEO_QUALITY = "basic" as const;
