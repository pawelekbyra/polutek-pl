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

/** Paths protected by Cloudflare Turnstile (Better Auth path, without /api/auth). */
export const CAPTCHA_ENDPOINTS = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/send-verification-email",
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

/** One-time bootstrap list: verified accounts with these e-mails become ADMIN (see resolveDbBackedActor). */
export function getAdminEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!email) return false;
  return getAdminEmails(env).includes(email.trim().toLowerCase());
}

export function isCaptchaConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

export function isGoogleConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}
