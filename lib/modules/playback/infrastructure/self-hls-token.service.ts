import { createHmac } from 'node:crypto';

/**
 * Short-lived delivery tokens for our own HLS (workers/hls-edge/worker.mjs).
 *
 * URL: <base>/h/<exp>.<sig>[.pub]/<videoId>/<version>/master.m3u8
 *   sig = base64url(HMAC-SHA256(secret, "<videoId>/<version>/<exp>"))            (protected, the original format)
 *   sig = base64url(HMAC-SHA256(secret, "<videoId>/<version>/<exp>/pub"))  + ".pub"  (PUBLIC video)
 *
 * The ".pub" kind is signed, so it cannot be added to a protected token. The Worker answers a
 * token WITHOUT ".pub" (every token issued before this format existed too) with private,
 * token-bounded cache headers, and only a ".pub" token with the long public ones (audit S09).
 * Token lifetime (audit S08): protected videos get a short TTL, capped at the end of the grant.

 * One token covers every file of one video version. Issue it only after the
 * access decision and the premiere gate (CLAUDE.md 4.3 / 4.15); a denied plan
 * must never carry a URL. The algorithm is mirrored by the Worker's verifyToken.
 */

/** Public videos: long-lived bearer link, nothing to withdraw. */
export const SELF_HLS_DEFAULT_TTL_SECONDS = 6 * 60 * 60;
/** Protected videos (LOGGED_IN, PAID, patron zone, previews): the player renews 2 minutes before expiry. */
export const SELF_HLS_PROTECTED_DEFAULT_TTL_SECONDS = 30 * 60;
const PROTECTED_TTL_MIN_SECONDS = 5 * 60;
const PROTECTED_TTL_MAX_SECONDS = 6 * 60 * 60;
/** Never issue a token shorter than this, even when the grant ends sooner (the next renewal is then refused). */
export const SELF_HLS_MIN_TTL_SECONDS = 30;
export const SELF_HLS_DEFAULT_BASE_URL = 'https://video.pawelperfect.com';

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const VERSION_RE = /^[A-Za-z0-9_-]{1,32}$/;

export type SelfHlsSignInput = {
  videoId: string;
  version: string;
  secret: string;
  nowMs?: number;
  ttlSeconds?: number;
  /** PUBLIC video: the token carries the signed ".pub" marker (long public cache at the edge). */
  isPublic?: boolean;
};

export type SelfHlsTtlInput = {
  isPublic: boolean;
  /** End of the viewer's grant (patron pass), when it ends before the default TTL. */
  accessEndsAt?: Date | null;
  nowMs?: number;
  env?: NodeJS.ProcessEnv;
};

export type SelfHlsSignedUrl = {
  token: string;
  masterUrl: string;
  /** "<base>/h/<token>/<videoId>/<version>": the folder every file of this token (HLS and captions) lives under. */
  deliveryPrefix: string;
  expiresAt: Date;
};

export function tokenMessage(videoId: string, version: string, exp: number, isPublic = false): string {
  return `${videoId}/${version}/${exp}${isPublic ? '/pub' : ''}`;
}

function envSeconds(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw?.trim());
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
}

export class SelfHlsTokenService {
  static secret(env: NodeJS.ProcessEnv = process.env): string | null {
    const s = env.HLS_TOKEN_SECRET?.trim();
    return s && s.length >= 32 ? s : null;
  }

  static baseUrl(env: NodeJS.ProcessEnv = process.env): string {
    return (env.HLS_DELIVERY_BASE_URL?.trim() || SELF_HLS_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  /**
   * Lifetime of a new token. Public: HLS_TOKEN_TTL_PUBLIC_SECONDS (default 6 h). Protected:
   * HLS_TOKEN_TTL_PROTECTED_SECONDS (default 30 min, clamped to 5 min .. 6 h), and never past the
   * end of the grant (but at least SELF_HLS_MIN_TTL_SECONDS).
   */
  static ttlSeconds(input: SelfHlsTtlInput): number {
    const env = input.env ?? process.env;
    if (input.isPublic) {
      return envSeconds(env.HLS_TOKEN_TTL_PUBLIC_SECONDS, SELF_HLS_DEFAULT_TTL_SECONDS, 60, 24 * 60 * 60);
    }
    const base = envSeconds(env.HLS_TOKEN_TTL_PROTECTED_SECONDS, SELF_HLS_PROTECTED_DEFAULT_TTL_SECONDS, PROTECTED_TTL_MIN_SECONDS, PROTECTED_TTL_MAX_SECONDS);
    const endsAt = input.accessEndsAt?.getTime();
    if (endsAt === undefined || Number.isNaN(endsAt)) return base;
    const remaining = Math.floor((endsAt - (input.nowMs ?? Date.now())) / 1000);
    return Math.max(SELF_HLS_MIN_TTL_SECONDS, Math.min(base, remaining));
  }

  /** Public tokens carry the ".pub" marker unless HLS_PUBLIC_TOKEN_MARKER=off (rollback while the Worker is old). */
  static publicMarkerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.HLS_PUBLIC_TOKEN_MARKER?.trim().toLowerCase() !== 'off';
  }

  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return SelfHlsTokenService.secret(env) !== null;
  }

  static sign(input: SelfHlsSignInput, baseUrl = SELF_HLS_DEFAULT_BASE_URL): SelfHlsSignedUrl {
    if (!ID_RE.test(input.videoId) || !VERSION_RE.test(input.version)) {
      throw new Error('Invalid self-hosted HLS identifiers');
    }
    if (!input.secret || input.secret.length < 32) throw new Error('HLS token secret missing or too short');
    const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
    const exp = nowSeconds + (input.ttlSeconds ?? SELF_HLS_DEFAULT_TTL_SECONDS);
    const isPublic = input.isPublic === true;
    const sig = createHmac('sha256', input.secret).update(tokenMessage(input.videoId, input.version, exp, isPublic)).digest('base64url');
    const token = isPublic ? `${exp}.${sig}.pub` : `${exp}.${sig}`;
    const deliveryPrefix = `${baseUrl}/h/${token}/${input.videoId}/${input.version}`;
    return {
      token,
      masterUrl: `${deliveryPrefix}/master.m3u8`,
      deliveryPrefix,
      expiresAt: new Date(exp * 1000),
    };
  }
}
