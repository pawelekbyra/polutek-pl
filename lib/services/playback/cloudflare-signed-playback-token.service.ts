import { createSign } from 'node:crypto';

export type CloudflareSignedPlaybackToken = {
  token: string;
  expiresAt: Date;
  expiresInSeconds: number;
};

export type CloudflareSignedPlaybackTokenInput = {
  videoUid: string;
  now?: Date;
  ttlSeconds?: number;
};

const DEFAULT_TTL_SECONDS = 60 * 60;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 12 * 60 * 60;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function readTtlSeconds(input?: number): number {
  const configured = input ?? Number(process.env.CLOUDFLARE_STREAM_SIGNED_TOKEN_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(configured)));
}

function readPrivateKey(): string {
  const raw = process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY || process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM;
  if (!raw?.trim()) throw new Error('Cloudflare Stream signing private key is not configured');
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

function readKeyId(): string {
  const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
  if (!keyId?.trim()) throw new Error('Cloudflare Stream signing key id is not configured');
  return keyId.trim();
}

export class CloudflareSignedPlaybackTokenService {
  static createSignedPlaybackToken(input: CloudflareSignedPlaybackTokenInput): CloudflareSignedPlaybackToken {
    const videoUid = input.videoUid.trim();
    if (!videoUid) throw new Error('Cloudflare Stream video uid is required for signed playback');

    const kid = readKeyId();
    const privateKey = readPrivateKey();
    const ttlSeconds = readTtlSeconds(input.ttlSeconds);
    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
    const expiresAtSeconds = nowSeconds + ttlSeconds;

    const header = { alg: 'RS256', kid };
    const payload = {
      sub: videoUid,
      kid,
      exp: expiresAtSeconds,
      nbf: nowSeconds - 5,
    };

    const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
    const signature = createSign('RSA-SHA256').update(signingInput).end().sign(privateKey);

    return {
      token: `${signingInput}.${base64UrlEncode(signature)}`,
      expiresAt: new Date(expiresAtSeconds * 1000),
      expiresInSeconds: ttlSeconds,
    };
  }
}
