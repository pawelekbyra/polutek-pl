/**
 * Runtime configuration of the admin panel, read from the environment in one place.
 * Names and meaning: .env.example (section "Panel administratora") and docs/operations/ADMIN-PANEL.md.
 * Pure functions over an env object so tests can pass their own.
 */
export type Env = Record<string, string | undefined>;

export const ADMIN_COOKIE_PREFIX = "ppadm";
/** Idle timeout: a session not used for this long expires (sliding window, refreshed every 5 min). */
export const ADMIN_SESSION_IDLE_SECONDS = 60 * 60;
export const ADMIN_SESSION_UPDATE_AGE_SECONDS = 5 * 60;
/** Absolute session lifetime counted from sign-in, whatever the activity. */
export const ADMIN_SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60;
/** How long a sign-in or step-up counts as "fresh" for sensitive actions. */
export const ADMIN_STEP_UP_SECONDS = 5 * 60;
/** Lifetime of the one-time enrollment link printed by admin-enroll. */
export const ADMIN_ENROLL_TTL_SECONDS = 15 * 60;

const isProd = (env: Env) => env.NODE_ENV === "production";

export function getAdminAppUrl(env: Env = process.env): string {
  const raw = env.ADMIN_APP_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return isProd(env) ? "https://admin.pawelperfect.com" : "http://localhost:3100";
}

export function getAdminOrigin(env: Env = process.env): string {
  return new URL(getAdminAppUrl(env)).origin;
}

/** WebAuthn relying party: the panel host only, so a passkey for www never works here and vice versa. */
export function getRelyingPartyId(env: Env = process.env): string {
  return new URL(getAdminAppUrl(env)).hostname;
}

export function resolveAdminAuthSecret(env: Env = process.env): string {
  const secret = env.ADMIN_AUTH_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (env.NEXT_PHASE === "phase-production-build" || !isProd(env)) {
    return "admin-dev-or-build-only-secret-0123456789abcdef";
  }
  throw new Error("ADMIN_AUTH_SECRET (min. 32 znaki, inny niż BETTER_AUTH_SECRET) jest wymagany w produkcji.");
}

/** The owner of the panel: the only address that is provisioned automatically (role OWNER) in access mode. */
export const DEFAULT_OWNER_EMAIL = "pawel.perfect@gmail.com";
/**
 * Access mode: how old (iat) the Cloudflare Access token may be for a sensitive action (money, delete, export,
 * role change). Equals the 12 h session of the Access application, so it is true for every valid token of a
 * correctly configured application and only bites when someone stretches the Access session to days.
 */
export const ADMIN_ACCESS_MAX_AGE_SECONDS = 12 * 60 * 60;
/** Cloudflare Access sign-out for the application's own host (revokes the Access session, not just the cookie). */
export const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

/**
 * How a person signs in to the panel.
 *  - "access"  (default): the verified Cloudflare Access JWT is the sign-in (e-mail from the signed payload).
 *  - "passkey" (legacy): Access + the panel's own passkey/TOTP login, enrollment and step-up.
 * An unknown value is NOT silently mapped to the weaker mode: it fails closed (see getAccessConfig) and the
 * guards treat it as the stricter "passkey".
 */
export type AdminAuthMode = "access" | "passkey";

export function parseAdminAuthMode(env: Env = process.env): { ok: true; mode: AdminAuthMode } | { ok: false; value: string } {
  const raw = env.ADMIN_AUTH_MODE?.trim().toLowerCase();
  if (!raw) return { ok: true, mode: "access" };
  if (raw === "access" || raw === "passkey") return { ok: true, mode: raw };
  return { ok: false, value: raw.slice(0, 40) };
}

export function getAdminAuthMode(env: Env = process.env): AdminAuthMode {
  const parsed = parseAdminAuthMode(env);
  return parsed.ok ? parsed.mode : "passkey";
}

/** Text of the "confirm identity first" refusal: legacy (passkey/TOTP) wording, or the access-mode one. */
export function stepUpMessage(legacy: string, env: Env = process.env): string {
  return getAdminAuthMode(env) === "access" ? "Zaloguj się ponownie przez Cloudflare Access: ostatnie logowanie jest starsze niż 12 godzin." : legacy;
}

export function getOwnerEmail(env: Env = process.env): string {
  return env.ADMIN_OWNER_EMAIL?.trim().toLowerCase() || DEFAULT_OWNER_EMAIL;
}

export type AccessConfig =
  | { mode: "enforce"; teamDomain: string; audience: string; allowedEmails: string[]; requireEmail?: boolean }
  | { mode: "dev-bypass" }
  | { mode: "misconfigured"; reason: string };

/**
 * Cloudflare Access settings. Production ALWAYS enforces: without the team domain and the application
 * AUD tag every request is refused (fail closed). The bypass exists only for `next dev` on localhost.
 */
export function getAccessConfig(env: Env = process.env): AccessConfig {
  if (!isProd(env) && env.ADMIN_DEV_BYPASS_ACCESS === "1") return { mode: "dev-bypass" };
  const authMode = parseAdminAuthMode(env);
  if (!authMode.ok) return { mode: "misconfigured", reason: `ADMIN_AUTH_MODE ma nieznaną wartość „${authMode.value}” (dozwolone: access, passkey)` };
  const teamRaw = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();
  if (!teamRaw || !audience) return { mode: "misconfigured", reason: "CF_ACCESS_TEAM_DOMAIN i CF_ACCESS_AUD są wymagane" };
  let teamDomain: string;
  try {
    const url = new URL(teamRaw.startsWith("http") ? teamRaw : `https://${teamRaw}`);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com")) {
      return { mode: "misconfigured", reason: "CF_ACCESS_TEAM_DOMAIN musi być adresem https://<zespół>.cloudflareaccess.com" };
    }
    teamDomain = url.origin;
  } catch {
    return { mode: "misconfigured", reason: "CF_ACCESS_TEAM_DOMAIN nie jest poprawnym adresem" };
  }
  let allowedEmails = (env.ADMIN_ACCESS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Access mode: the e-mail IS the login, so the list is never empty (default = the owner, explicit here and in the docs).
  if (authMode.mode === "access" && allowedEmails.length === 0) allowedEmails = [getOwnerEmail(env)];
  return { mode: "enforce", teamDomain, audience, allowedEmails, requireEmail: authMode.mode === "access" };
}

/**
 * Local development only: in access mode the Access bypass (ADMIN_DEV_BYPASS_ACCESS=1) acts as this address
 * (ADMIN_DEV_EMAIL, default the owner). Never read in production (the bypass itself is refused there).
 */
export function getDevAccessEmail(env: Env = process.env): string {
  return env.ADMIN_DEV_EMAIL?.trim().toLowerCase() || getOwnerEmail(env);
}

/** Sample data for `next dev` without a database (screenshots, layout work). Never in production. */
export function isDevFixturesEnabled(env: Env = process.env): boolean {
  return !isProd(env) && env.ADMIN_DEV_FIXTURES === "1";
}

/** Same as useDevFixtures, for the signed-in owner: lets the shell render without a database in dev. */
export function isDevAuthBypassEnabled(env: Env = process.env): boolean {
  return !isProd(env) && env.ADMIN_DEV_BYPASS_AUTH === "1";
}
