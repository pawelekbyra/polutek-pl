import { createHmac } from 'node:crypto';

/**
 * Short-lived delivery tokens for our own HLS (workers/hls-edge/worker.mjs).
 *
 * URL: <base>/h/<exp>.<sig>/<videoId>/<version>/master.m3u8
 *   sig = base64url(HMAC-SHA256(secret, "<videoId>/<version>/<exp>"))
 *
 * One token covers every file of one video version. Issue it only after the
 * access decision and the premiere gate (CLAUDE.md 4.3 / 4.15); a denied plan
 * must never carry a URL. The algorithm is mirrored by the Worker's verifyToken.
 */

export const SELF_HLS_DEFAULT_TTL_SECONDS = 6 * 60 * 60;
export const SELF_HLS_DEFAULT_BASE_URL = 'https://video.pawelperfect.com';

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const VERSION_RE = /^[A-Za-z0-9_-]{1,32}$/;

export type SelfHlsSignInput = {
  videoId: string;
  version: string;
  secret: string;
  nowMs?: number;
  ttlSeconds?: number;
};

export type SelfHlsSignedUrl = {
  token: string;
  masterUrl: string;
  expiresAt: Date;
};

export function tokenMessage(videoId: string, version: string, exp: number): string {
  return `${videoId}/${version}/${exp}`;
}

export class SelfHlsTokenService {
  static secret(env: NodeJS.ProcessEnv = process.env): string | null {
    const s = env.HLS_TOKEN_SECRET?.trim();
    return s && s.length >= 32 ? s : null;
  }

  static baseUrl(env: NodeJS.ProcessEnv = process.env): string {
    return (env.HLS_DELIVERY_BASE_URL?.trim() || SELF_HLS_DEFAULT_BASE_URL).replace(/\/+$/, '');
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
    const sig = createHmac('sha256', input.secret).update(tokenMessage(input.videoId, input.version, exp)).digest('base64url');
    const token = `${exp}.${sig}`;
    return {
      token,
      masterUrl: `${baseUrl}/h/${token}/${input.videoId}/${input.version}/master.m3u8`,
      expiresAt: new Date(exp * 1000),
    };
  }
}
