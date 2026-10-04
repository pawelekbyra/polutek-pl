/**
 * CSRF rule for every mutating request to the panel. `www.` and `admin.` share one registrable domain,
 * so SameSite cookies do NOT stop a request from www to admin; the panel therefore demands the exact
 * panel origin, and when a browser sends `Sec-Fetch-Site`, it must say `same-origin`.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type CsrfVerdict = { ok: true } | { ok: false; reason: "origin_mismatch" | "missing_origin" | "cross_site" };

export function checkPanelCsrf(method: string, headers: Headers, panelOrigin: string): CsrfVerdict {
  if (!MUTATING.has(method.toUpperCase())) return { ok: true };
  const site = headers.get("sec-fetch-site")?.toLowerCase() ?? null;
  if (site !== null && site !== "same-origin") return { ok: false, reason: "cross_site" };
  const origin = headers.get("origin");
  if (origin === null) return { ok: false, reason: "missing_origin" };
  return origin === panelOrigin ? { ok: true } : { ok: false, reason: "origin_mismatch" };
}
