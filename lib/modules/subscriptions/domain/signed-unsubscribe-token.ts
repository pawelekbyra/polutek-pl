import { createHmac, timingSafeEqual } from 'crypto';

export const CONTENT_UNSUBSCRIBE_PURPOSE = 'content-notification-unsubscribe' as const;
const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

type Payload = {
  v: 1;
  p: typeof CONTENT_UNSUBSCRIBE_PURPOSE;
  sub: string;
  exp: number;
};

type VerifyResult =
  | { ok: true; subject: string; expiresAt: Date }
  | { ok: false; reason: 'missing_secret' | 'malformed' | 'invalid' | 'expired' };

function getSecret() {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET;
  return typeof secret === 'string' && secret.trim().length >= 32 ? secret : null;
}

function base64urlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function base64urlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(encodedPayload: string, secret: string) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function createContentUnsubscribeToken(subject: string, options: { now?: Date; ttlSeconds?: number } = {}) {
  const secret = getSecret();
  if (!secret) return null;

  const now = options.now ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const payload: Payload = {
    v: TOKEN_VERSION,
    p: CONTENT_UNSUBSCRIBE_PURPOSE,
    sub: subject,
    exp: Math.floor(now.getTime() / 1000) + ttlSeconds,
  };
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyContentUnsubscribeToken(token: string | null | undefined, options: { now?: Date } = {}): VerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!token || typeof token !== 'string' || token.length > 2048) return { ok: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = sign(encodedPayload, secret);
  const expected = Buffer.from(expectedSignature, 'base64url');
  const provided = Buffer.from(providedSignature, 'base64url');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return { ok: false, reason: 'invalid' };

  let payload: Partial<Payload>;
  try {
    payload = JSON.parse(base64urlDecode(encodedPayload));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (payload.v !== TOKEN_VERSION || payload.p !== CONTENT_UNSUBSCRIBE_PURPOSE || typeof payload.sub !== 'string' || !payload.sub || typeof payload.exp !== 'number') {
    return { ok: false, reason: 'invalid' };
  }

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (payload.exp < nowSeconds) return { ok: false, reason: 'expired' };

  return { ok: true, subject: payload.sub, expiresAt: new Date(payload.exp * 1000) };
}

export function buildContentUnsubscribeUrl(subject: string, appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') {
  const token = createContentUnsubscribeToken(subject);
  if (!token) return null;
  const url = new URL('/unsubscribe', appUrl);
  url.searchParams.set('token', token);
  return url.toString();
}
