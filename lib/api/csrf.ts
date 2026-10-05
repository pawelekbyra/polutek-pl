/**
 * CSRF protection for cookie-authenticated mutations on the public site.
 *
 * Enforced centrally in middleware.ts for every POST/PUT/PATCH/DELETE under
 * /api/user (one place, so a new account route can't forget it, and no custom
 * header is needed). The admin panel has its own check (apps/admin/lib/security/csrf.ts).
 *
 * Edge-safe: no Node-only imports (middleware runs on the Edge runtime).
 *
 * Rule:
 *  - `Origin` present  -> its host must be an allowed host.
 *  - `Origin` absent   -> allowed only when `Sec-Fetch-Site` is absent
 *    (non-browser client / old browser) or `same-origin` / `none`;
 *    `cross-site` / `same-site` are rejected.
 *
 * ADMIN_CSRF_MODE = `enforce` (default) | `report` (log only, never blocks).
 */
import { logger } from "@/lib/logger";

export type CsrfMode = "enforce" | "report";

export type CsrfResult = { ok: true } | { ok: false; reason: string };

type HeaderSource = { headers: Headers };
type CsrfEnv = Record<string, string | undefined>;

export function getCsrfMode(env: CsrfEnv = process.env): CsrfMode {
  return env.ADMIN_CSRF_MODE?.trim().toLowerCase() === "report" ? "report" : "enforce";
}

function stripWww(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Hostnames (no port) derived from NEXT_PUBLIC_APP_URL, with www/apex variants. */
function getConfiguredHostnames(env: CsrfEnv): Set<string> {
  const hosts = new Set<string>();
  const raw = env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const bare = stripWww(new URL(raw).hostname);
      hosts.add(bare);
      hosts.add(`www.${bare}`);
    } catch {
      // Invalid app URL: fall back to the request host only.
    }
  }
  return hosts;
}

function parseOriginHost(origin: string): { host: string; hostname: string } | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { host: url.host.toLowerCase(), hostname: url.hostname.toLowerCase() };
  } catch {
    return null; // includes the literal "null" origin
  }
}

export function assertSameOrigin(req: HeaderSource, env: CsrfEnv = process.env): CsrfResult {
  const origin = req.headers.get("origin");
  const secFetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase() ?? null;

  if (origin !== null) {
    const parsed = parseOriginHost(origin);
    if (!parsed) return { ok: false, reason: "invalid_origin" };

    const requestHost = (
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host") ||
      ""
    ).toLowerCase();

    if (requestHost && parsed.host === requestHost) return { ok: true };
    if (getConfiguredHostnames(env).has(parsed.hostname)) return { ok: true };
    if (env.NODE_ENV === "development" && isLocalHost(parsed.hostname)) return { ok: true };
    return { ok: false, reason: "origin_mismatch" };
  }

  if (secFetchSite === null || secFetchSite === "same-origin" || secFetchSite === "none") {
    return { ok: true };
  }
  return { ok: false, reason: "cross_site_without_origin" };
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutatingMethod(method: string) {
  return MUTATING_METHODS.has(method.toUpperCase());
}

/**
 * Applies the CSRF rule to a request. Returns a 403 JSON body descriptor when
 * the request must be blocked, `null` otherwise (including report mode).
 */
export function checkAdminCsrf(
  req: HeaderSource & { method: string; nextUrl?: { pathname: string } },
  env: CsrfEnv = process.env,
): { status: 403; body: { error: string; message: string } } | null {
  if (!isMutatingMethod(req.method)) return null;
  const result = assertSameOrigin(req, env);
  if (result.ok) return null;

  logger.warn("[AdminCSRF] Cross-origin admin mutation", {
    reason: result.reason,
    method: req.method,
    path: req.nextUrl?.pathname,
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    mode: getCsrfMode(env),
  });

  if (getCsrfMode(env) === "report") return null;
  return { status: 403, body: { error: "Forbidden", message: "Cross-origin request rejected." } };
}
