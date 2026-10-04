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

export type AccessConfig =
  | { mode: "enforce"; teamDomain: string; audience: string; allowedEmails: string[] }
  | { mode: "dev-bypass" }
  | { mode: "misconfigured"; reason: string };

/**
 * Cloudflare Access settings. Production ALWAYS enforces: without the team domain and the application
 * AUD tag every request is refused (fail closed). The bypass exists only for `next dev` on localhost.
 */
export function getAccessConfig(env: Env = process.env): AccessConfig {
  if (!isProd(env) && env.ADMIN_DEV_BYPASS_ACCESS === "1") return { mode: "dev-bypass" };
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
  const allowedEmails = (env.ADMIN_ACCESS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return { mode: "enforce", teamDomain, audience, allowedEmails };
}

/** Sample data for `next dev` without a database (screenshots, layout work). Never in production. */
export function isDevFixturesEnabled(env: Env = process.env): boolean {
  return !isProd(env) && env.ADMIN_DEV_FIXTURES === "1";
}

/** Same as useDevFixtures, for the signed-in owner: lets the shell render without a database in dev. */
export function isDevAuthBypassEnabled(env: Env = process.env): boolean {
  return !isProd(env) && env.ADMIN_DEV_BYPASS_AUTH === "1";
}
