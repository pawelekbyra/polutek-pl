/**
 * Contract of the analytics beacon: what the browser sends to /api/t and what pp-collector accepts.
 * Shared by the client (types only, so zod never reaches the bundle) and services/pp-collector.
 *
 * Privacy (docs/architecture/admin-telemetry.md): no identifiers that live on the device, no full URLs,
 * no query strings except utm_*, no user ids. The collector turns IP + user agent into a daily-salted
 * visitor hash and drops both.
 */
import { z } from 'zod';
import { BEACON_VERSION, WATCHED_HEX_LENGTH, WEB_VITAL_METRICS } from './beacon-constants';

export * from './beacon-constants';

const shortText = (max: number) => z.string().trim().min(1).max(max);
const count = z.number().int().min(0).max(1_000_000);
const durationMs = z.number().int().min(0).max(24 * 60 * 60 * 1000);

/** Public ids of videos (cuid/uuid-like): no free text. */
const videoId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const pageViewSchema = z.object({
  /** location.pathname only. */
  path: z.string().max(512),
  /** document.referrer (the collector keeps only its host). */
  referrer: z.string().max(2048).optional(),
  utmSource: shortText(64).optional(),
  utmMedium: shortText(64).optional(),
  utmCampaign: shortText(64).optional(),
  /** UI language of the page (pl/en/...). */
  lang: z.string().regex(/^[a-z]{2}$/).optional(),
});

export const webVitalSchema = z.object({
  name: z.enum(WEB_VITAL_METRICS),
  value: z.number().min(0).max(600_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  navigationType: z.string().regex(/^[a-z_-]{1,32}$/).optional(),
  path: z.string().max(512),
});

/**
 * One play attempt's quality since the previous beacon of the same attempt. `attempt` is a random id
 * that lives only in page memory (never stored on the device), so deltas of one attempt can be joined.
 */
export const playbackSchema = z.object({
  attempt: z.string().regex(/^[0-9a-f]{16}$/),
  videoId,
  started: z.boolean().optional(),
  startupMs: durationMs.optional(),
  exitedBeforeStart: z.boolean().optional(),
  watchMs: durationMs.optional(),
  rebufferCount: count.optional(),
  rebufferMs: durationMs.optional(),
  /** Coarse error class (hls.js type/details or MediaError code), never a message or URL. */
  errorCode: z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/).optional(),
  fatalError: z.boolean().optional(),
  bitrateKbps: z.number().int().min(0).max(200_000).optional(),
  maxHeight: z.number().int().min(0).max(8640).optional(),
  switches: count.optional(),
  watched: z.string().regex(new RegExp(`^[0-9a-f]{${WATCHED_HEX_LENGTH}}$`)).optional(),
});

export const beaconSchema = z.object({
  v: z.literal(BEACON_VERSION),
  signedIn: z.boolean().optional(),
  /** navigator.webdriver: automated browsers are dropped. */
  automated: z.boolean().optional(),
  pageView: pageViewSchema.optional(),
  vitals: z.array(webVitalSchema).max(20).optional(),
  playback: z.array(playbackSchema).max(10).optional(),
});

export type BeaconPayload = z.infer<typeof beaconSchema>;
export type BeaconPageView = z.infer<typeof pageViewSchema>;
export type BeaconWebVital = z.infer<typeof webVitalSchema>;
export type BeaconPlayback = z.infer<typeof playbackSchema>;
