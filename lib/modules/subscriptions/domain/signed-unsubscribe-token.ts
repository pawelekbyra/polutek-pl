import { createHmac, timingSafeEqual } from 'crypto';

export const CONTENT_UNSUBSCRIBE_PURPOSE = 'content-notification-unsubscribe' as const;
const TOKEN_VERSION = 1;

/**
 * Signed, user-bound unsubscribe token. It never expires: an unsubscribe link must keep working in
 * every email ever sent (GDPR art. 21, Gmail/Yahoo bulk-sender rules), and the token can only turn
 * notifications off, so an old link is worth nothing to an attacker. Older tokens carry an `exp`
 * field from when they expired after 7 days; it is ignored.
 *
 * Rotation: put the old secret in EMAIL_UNSUBSCRIBE_SIGNING_SECRET_PREVIOUS so links signed with it
 * keep working while new mails use the new EMAIL_UNSUBSCRIBE_SIGNING_SECRET.
 */
type Payload = {
  v: 1;
  p: typeof CONTENT_UNSUBSCRIBE_PURPOSE;
  sub: string;
  exp?: number;
};

type VerifyResult =
  | { ok: true; subject: string }
  | { ok: false; reason: 'missing_secret' | 'malformed' | 'invalid' };

function usableSecret(value: string | undefined): string | null {
  const secret = value?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function getSigningSecret() {
  return usableSecret(process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET);
}

function getVerificationSecrets(): string[] {
  return [
    usableSecret(process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET),
    usableSecret(process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET_PREVIOUS),
  ].filter((secret): secret is string => secret !== null);
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

function signatureMatches(encodedPayload: string, providedSignature: string, secret: string) {
  const expected = Buffer.from(sign(encodedPayload, secret), 'base64url');
  const provided = Buffer.from(providedSignature, 'base64url');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function createContentUnsubscribeToken(subject: string) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const payload: Payload = { v: TOKEN_VERSION, p: CONTENT_UNSUBSCRIBE_PURPOSE, sub: subject };
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyContentUnsubscribeToken(token: string | null | undefined): VerifyResult {
  const secrets = getVerificationSecrets();
  if (secrets.length === 0) return { ok: false, reason: 'missing_secret' };
  if (!token || typeof token !== 'string' || token.length > 2048) return { ok: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [encodedPayload, providedSignature] = parts;
  if (!secrets.some((secret) => signatureMatches(encodedPayload, providedSignature, secret))) {
    return { ok: false, reason: 'invalid' };
  }

  let payload: Partial<Payload>;
  try {
    payload = JSON.parse(base64urlDecode(encodedPayload));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (payload.v !== TOKEN_VERSION || payload.p !== CONTENT_UNSUBSCRIBE_PURPOSE || typeof payload.sub !== 'string' || !payload.sub) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, subject: payload.sub };
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/** Link shown in the email body: a page with a confirm button (link scanners only ever GET it). */
export function buildContentUnsubscribeUrl(subject: string, appUrl = appBaseUrl()) {
  const token = createContentUnsubscribeToken(subject);
  if (!token) return null;
  const url = new URL('/unsubscribe', appUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

/** Target of the List-Unsubscribe header: mailbox providers POST `List-Unsubscribe=One-Click` here (RFC 8058). */
export function buildOneClickUnsubscribeUrl(subject: string, appUrl = appBaseUrl()) {
  const token = createContentUnsubscribeToken(subject);
  if (!token) return null;
  const url = new URL('/api/subscriptions/unsubscribe', appUrl);
  url.searchParams.set('token', token);
  return url.toString();
}
