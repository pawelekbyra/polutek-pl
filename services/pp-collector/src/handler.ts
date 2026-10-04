import { BEACON_MAX_BYTES, beaconSchema } from '../../../lib/telemetry/beacon-contract';
import {
  classifyBrowser,
  classifyDevice,
  classifyOs,
  isBotUserAgent,
  normalizeCampaignValue,
  normalizeCountry,
  normalizePath,
  referrerHost,
} from './classify';
import { attemptId, visitorHash, watchedBits } from './visitor';

/** Columns of telemetry.page_view (bigints as decimal strings: exact, and Postgres casts them). */
export interface PageViewRow {
  ts: Date;
  visitor: string;
  path: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  device: string;
  browser: string;
  os: string;
  lang: string | null;
  signed_in: boolean;
}

export interface WebVitalRow {
  ts: Date;
  path: string;
  metric: string;
  value: number;
  rating: string | null;
  nav_type: string | null;
  device: string;
}

export interface PlaybackRow {
  ts: Date;
  attempt: string;
  visitor: string;
  video_id: string;
  started: boolean;
  startup_ms: number | null;
  exited_before_start: boolean;
  watch_ms: number;
  rebuffer_count: number;
  rebuffer_ms: number;
  error_code: string | null;
  fatal_error: boolean;
  bitrate_kbps: number | null;
  max_height: number | null;
  switches: number;
  watched: string | null;
  device: string;
  country: string | null;
}

export interface BeaconRows {
  pageViews: PageViewRow[];
  vitals: WebVitalRow[];
  playback: PlaybackRow[];
}

/** Request data the www app forwards to the collector (see app/api/t/route.ts). */
export interface BeaconRequest {
  body: string;
  ip: string | undefined;
  userAgent: string | undefined;
  country: string | undefined;
  origin: string | undefined;
  referer: string | undefined;
  doNotTrack: boolean;
}

export interface CollectorPolicy {
  /** Hosts the beacon may come from (www.pawelperfect.com). Also treated as "internal" referrers. */
  allowedHosts: readonly string[];
  take: (key: string, nowMs: number) => boolean;
}

export type BeaconOutcome =
  | { status: 204; reason: 'accepted'; rows: BeaconRows }
  | { status: 204; reason: 'dnt' | 'bot' | 'automated' | 'empty' }
  | { status: 400; reason: 'invalid' }
  | { status: 403; reason: 'origin' }
  | { status: 413; reason: 'too_large' }
  | { status: 429; reason: 'rate_limited' };

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validates one beacon and turns it into rows. No I/O: the caller passes the day's salt and the clock.
 * Drops (with 204, the browser never retries) everything we must not or need not count: Do Not Track /
 * Global Privacy Control, bots, automated browsers.
 */
export function processBeacon(request: BeaconRequest, salt: Buffer, now: Date, policy: CollectorPolicy): BeaconOutcome {
  if (request.doNotTrack) return { status: 204, reason: 'dnt' };
  if (Buffer.byteLength(request.body, 'utf8') > BEACON_MAX_BYTES) return { status: 413, reason: 'too_large' };

  const sourceHost = hostOf(request.origin) ?? hostOf(request.referer);
  if (!sourceHost || !policy.allowedHosts.includes(sourceHost)) return { status: 403, reason: 'origin' };

  const userAgent = request.userAgent ?? '';
  if (isBotUserAgent(userAgent)) return { status: 204, reason: 'bot' };
  if (!request.ip) return { status: 400, reason: 'invalid' };

  let json: unknown;
  try {
    json = JSON.parse(request.body);
  } catch {
    return { status: 400, reason: 'invalid' };
  }
  const parsed = beaconSchema.safeParse(json);
  if (!parsed.success) return { status: 400, reason: 'invalid' };
  const beacon = parsed.data;
  if (beacon.automated) return { status: 204, reason: 'automated' };

  const visitorBig = visitorHash(salt, request.ip, userAgent, sourceHost);
  if (!policy.take(visitorBig.toString(), now.getTime())) return { status: 429, reason: 'rate_limited' };
  const visitor = visitorBig.toString();

  const device = classifyDevice(userAgent);
  const country = normalizeCountry(request.country);
  const rows: BeaconRows = { pageViews: [], vitals: [], playback: [] };

  if (beacon.pageView) {
    const path = normalizePath(beacon.pageView.path);
    if (path) {
      rows.pageViews.push({
        ts: now,
        visitor,
        path,
        referrer_host: referrerHost(beacon.pageView.referrer, policy.allowedHosts),
        utm_source: normalizeCampaignValue(beacon.pageView.utmSource),
        utm_medium: normalizeCampaignValue(beacon.pageView.utmMedium),
        utm_campaign: normalizeCampaignValue(beacon.pageView.utmCampaign),
        country,
        device,
        browser: classifyBrowser(userAgent),
        os: classifyOs(userAgent),
        lang: beacon.pageView.lang ?? null,
        signed_in: beacon.signedIn === true,
      });
    }
  }

  for (const vital of beacon.vitals ?? []) {
    const path = normalizePath(vital.path);
    if (!path) continue;
    rows.vitals.push({
      ts: now,
      path,
      metric: vital.name,
      value: vital.value,
      rating: vital.rating ?? null,
      nav_type: vital.navigationType ?? null,
      device,
    });
  }

  for (const item of beacon.playback ?? []) {
    rows.playback.push({
      ts: now,
      attempt: attemptId(item.attempt).toString(),
      visitor,
      video_id: item.videoId,
      started: item.started === true,
      startup_ms: item.started && item.startupMs !== undefined ? item.startupMs : null,
      exited_before_start: item.exitedBeforeStart === true && item.started !== true,
      watch_ms: item.watchMs ?? 0,
      rebuffer_count: item.rebufferCount ?? 0,
      rebuffer_ms: item.rebufferMs ?? 0,
      error_code: item.errorCode ?? null,
      fatal_error: item.fatalError === true,
      bitrate_kbps: item.bitrateKbps ?? null,
      max_height: item.maxHeight ?? null,
      switches: item.switches ?? 0,
      watched: item.watched ? watchedBits(item.watched) : null,
      device,
      country,
    });
  }

  if (rows.pageViews.length + rows.vitals.length + rows.playback.length === 0) {
    return { status: 204, reason: 'empty' };
  }
  return { status: 204, reason: 'accepted', rows };
}
