/**
 * Static configuration of the Better Auth instance, kept free of side effects so it can be unit
 * tested and imported by the middleware, the env validator and the instance builder.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const SESSION_COOKIE_PREFIX = "pp";
export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;
export const SESSION_FRESH_AGE_SECONDS = 60 * 60 * 24;
export const SESSION_COOKIE_CACHE_SECONDS = 60;
/** "Remember this device" after a TOTP code skips 2FA for this long (user opt-in, default off). */
export const TWO_FACTOR_TRUST_DEVICE_SECONDS = 60 * 60 * 24 * 7;
export const EMAIL_TOKEN_TTL_SECONDS = 60 * 60;
/**
 * Failed sign-in lockout (on top of Better Auth's per-IP request rule). Only FAILED attempts count
 * (wrong password), so successful sign-ins on many devices never throttle anybody.
 * - per e-mail + client IP: 10 failures / 15 min. The attacker's address is locked out, the real
 *   owner signing in from elsewhere is not, so a third party cannot lock a known address out.
 * - per e-mail across all IPs: a high ceiling (distributed guessing); each attempt costs a solved captcha.
 */
export const SIGN_IN_FAILURE_LIMIT_PER_IP = 10;
export const SIGN_IN_FAILURE_LIMIT_PER_EMAIL = 100;
export const SIGN_IN_FAILURE_WINDOW_SECONDS = 15 * 60;
/** Per-IP request budget for /sign-in/email (requests per minute, any outcome); roomy enough for shared networks. */
export const SIGN_IN_IP_RATE_PER_MINUTE = 10;

/**
 * E-mail change (each request sends a mail): per user, on top of the per-IP rule in auth.ts. Wrong
 * passwords count too, so the password check cannot be used as a guessing oracle.
 */
export const CHANGE_EMAIL_LIMIT_PER_USER = 5;
export const CHANGE_EMAIL_WINDOW_SECONDS = 60 * 60;
/** Password-reset / verification mails to one address (any IP), counted only after Turnstile passed. */
export const MAIL_TO_ADDRESS_LIMIT = 5;
export const MAIL_TO_ADDRESS_WINDOW_SECONDS = 60 * 60;

/**
 * Paths protected by Cloudflare Turnstile (Better Auth path, without /api/auth). Passkey sign-in is
 * deliberately not here: it needs a private key on the user's device plus a gesture, the challenge is
 * single-use, and the options request runs when the sign-in form opens (autofill), before any widget.
 */
export const CAPTCHA_ENDPOINTS = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/send-verification-email",
  // Passkey-first sign-up: the step where the visitor types an e-mail (lib/auth/passkey-signup.ts).
  "/passkey-signup/start",
] as const;

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/** Public origin of the app (OAuth callbacks, e-mail links). */
export function getAuthBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.BETTER_AUTH_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return stripTrailingSlash(raw);
}

/** Origins that may call the auth API: the app URL in its www and apex form plus explicit extras. */
export function getTrustedOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const origins = new Set<string>();
  const base = getAuthBaseUrl(env);
  origins.add(base);
  try {
    const url = new URL(base);
    if (url.hostname !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
      const bare = url.hostname.replace(/^www\./, "");
      origins.add(`${url.protocol}//${bare}`);
      origins.add(`${url.protocol}//www.${bare}`);
    }
  } catch {
    // invalid URL: only the raw value is trusted
  }
  for (const extra of (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",")) {
    const value = stripTrailingSlash(extra.trim());
    if (value) origins.add(value);
  }
  return Array.from(origins);
}

/** Name the browser shows in the passkey prompt ("Save a passkey for Pawel Perfect"). */
export const PASSKEY_RP_NAME = "Pawel Perfect";
/** Longest device name stored for a passkey (the user may type one; the server trims longer input). */
export const PASSKEY_NAME_MAX_LENGTH = 64;

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

/**
 * WebAuthn relying party (passkeys). The RP ID is the registrable domain without `www.`
 * (`pawelperfect.com`), so one passkey works on both www and the apex; in development it is
 * `localhost`. Only trusted origins on that domain (or its subdomains) are accepted as the
 * WebAuthn origin; it is never taken from the request's own Origin header.
 */
export function getPasskeyRelyingParty(env: Record<string, string | undefined> = process.env): {
  rpID: string;
  rpName: string;
  origin: string[];
} {
  const rpID = (hostnameOf(getAuthBaseUrl(env)) ?? "localhost").replace(/^www\./, "");
  const origin = getTrustedOrigins(env).filter((value) => {
    const host = hostnameOf(value);
    return host !== null && (host === rpID || host.endsWith(`.${rpID}`));
  });
  return { rpID, rpName: PASSKEY_RP_NAME, origin };
}

export function isCaptchaConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

export function isGoogleConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}
