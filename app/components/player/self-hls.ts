/**
 * Player side of our own HLS (CLAUDE.md 4.17): hls.js from our own bundle, its start-up
 * tuning, and delivery-token renewal without reloading the stream.
 *
 * Token: every delivery URL is "<origin>/h/<exp>.<sig>/<videoId>/<version>/<file>" and one
 * token covers every file of one version. When the plan is renewed the player keeps playing
 * and every later request (playlists, segments) is rewritten to the newest token, so position,
 * buffer and quality survive.
 */
import type { HlsConfig, LoadPolicy } from 'hls.js';

type HlsModule = typeof import('hls.js/light');

let hlsModule: Promise<HlsModule> | null = null;

/**
 * hls.js (light build: no in-manifest subtitles/alt audio/DRM, which our ladder doesn't use;
 * side-loaded WebVTT works) as a lazily loaded chunk of our own bundle, pinned in
 * package-lock.json. Started once, as early as possible, then shared.
 */
export function loadHlsLibrary(): Promise<HlsModule> {
  hlsModule ??= import('hls.js/light');
  return hlsModule;
}

const TOKEN_PATH_RE = /^\/h\/[^/]+\/([^/]+)\/([^/]+)\/(.+)$/;

/** "<origin>/<videoId>/<version>": what stays the same across token renewals of one stream. */
export function streamIdentity(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = TOKEN_PATH_RE.exec(u.pathname);
    return m ? `${u.origin}/${m[1]}/${m[2]}` : `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

/**
 * `requestUrl` with the token taken from `currentMasterUrl`, when both are delivery URLs of the
 * same stream (origin, video, version). Anything else is returned unchanged.
 */
export function withCurrentToken(requestUrl: string, currentMasterUrl: string | null | undefined): string {
  if (!currentMasterUrl) return requestUrl;
  try {
    const req = new URL(requestUrl);
    const cur = new URL(currentMasterUrl);
    const r = TOKEN_PATH_RE.exec(req.pathname);
    const c = /^\/h\/([^/]+)\/([^/]+)\/([^/]+)\//.exec(cur.pathname);
    if (!r || !c || req.origin !== cur.origin || r[1] !== c[2] || r[2] !== c[3]) return requestUrl;
    req.pathname = `/h/${c[1]}/${r[1]}/${r[2]}/${r[3]}`;
    return req.toString();
  } catch {
    return requestUrl;
  }
}

type NetworkInformationLike = { downlink?: number; saveData?: boolean; effectiveType?: string };

/**
 * Starting bandwidth estimate (bits/s) from the Network Information API when the browser has one
 * (Chromium); undefined elsewhere. Chromium caps `downlink` at 10 Mb/s and rounds it, so it is a
 * rough but real measurement, better than a fixed guess and free (no test download).
 */
export function connectionStartEstimate(connection: NetworkInformationLike | undefined): number | undefined {
  if (!connection) return undefined;
  if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') return 250_000;
  const mbps = connection.downlink;
  if (typeof mbps !== 'number' || !Number.isFinite(mbps) || mbps <= 0) return undefined;
  return Math.round(Math.min(Math.max(mbps, 0.3), 10) * 1_000_000 * 0.8);
}

/** 401/403 retries per request: the token is renewed meanwhile and the retry uses it. */
export const HLS_AUTH_RETRIES = 3;

function withAuthRetry(policy: LoadPolicy, onAuthError: () => void): LoadPolicy {
  const base = policy.default;
  const errorRetry = base.errorRetry ?? { maxNumRetry: 0, retryDelayMs: 1000, maxRetryDelayMs: 8000 };
  const normalMax = errorRetry.maxNumRetry;
  return {
    default: {
      ...base,
      errorRetry: {
        ...errorRetry,
        maxNumRetry: Math.max(normalMax, HLS_AUTH_RETRIES),
        shouldRetry: (_config, retryCount, _isTimeout, response, retry) => {
          const status = response?.code;
          if (status === 401 || status === 403) {
            onAuthError();
            return retryCount < HLS_AUTH_RETRIES;
          }
          return retry && retryCount < normalMax;
        },
      },
    },
  };
}

export type SelfHlsConfigInput = {
  defaults: HlsConfig;
  /** Newest signed master URL of the playing stream. */
  currentMasterUrl: () => string | null | undefined;
  /** Resolves once the token is usable (renews first when it is about to expire). */
  ensureFreshToken: () => Promise<void>;
  /** A request was refused (expired/invalid token): renew now. */
  onAuthError: () => void;
  connection?: NetworkInformationLike;
};

/**
 * hls.js settings for a fast, single-download start of short-segment VOD:
 * - no bandwidth test fragment (`testBandwidth: false`): the old default downloaded the first
 *   segment of the lowest rung and then the same seconds again in a higher rung;
 * - start rung: from the browser's own bandwidth estimate when there is one (`startLevel: -1`
 *   picks the rung that fits it), otherwise the master's first variant, which the encoder puts
 *   at the ~2 Mb/s rung (Apple: the first listed variant is the start variant);
 * - the first fragment is requested while the media element is still being attached;
 * - token renewal: see the file header.
 */
export function buildSelfHlsConfig(input: SelfHlsConfigInput): Partial<HlsConfig> {
  const estimate = connectionStartEstimate(input.connection);
  return {
    testBandwidth: false,
    startFragPrefetch: true,
    ...(estimate ? { startLevel: -1, abrEwmaDefaultEstimate: estimate } : {}),
    capLevelToPlayerSize: true,
    lowLatencyMode: false,
    maxBufferLength: 30,
    backBufferLength: 30,
    xhrSetup: async (xhr: XMLHttpRequest, url: string) => {
      await input.ensureFreshToken();
      xhr.open('GET', withCurrentToken(url, input.currentMasterUrl()), true);
    },
    manifestLoadPolicy: withAuthRetry(input.defaults.manifestLoadPolicy, input.onAuthError),
    playlistLoadPolicy: withAuthRetry(input.defaults.playlistLoadPolicy, input.onAuthError),
    fragLoadPolicy: withAuthRetry(input.defaults.fragLoadPolicy, input.onAuthError),
  };
}
