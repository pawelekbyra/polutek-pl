/**
 * Layer 1: Cloudflare Access. Access sits in front of the tunnel and adds a signed JWT to every request
 * (`Cf-Access-Jwt-Assertion`). The panel verifies it itself (RS256 signature against the team's public
 * keys, `iss` = team domain, `aud` = this application's AUD tag, `exp`), so a misconfigured tunnel
 * ingress or an exposed port still cannot reach the panel without passing Access.
 * Source: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AccessConfig } from "@admin/lib/config";

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export type AccessResult =
  | { ok: true; email: string | null; subject: string | null; country: string | null; dev?: true }
  | { ok: false; reason: "missing_token" | "invalid_token" | "email_not_allowed" | "not_configured"; detail?: string };

// One key set per team domain, kept for the life of the process. jose caches the keys (10 min) and
// refetches on an unknown `kid`, so a key rotation at Cloudflare is picked up without a restart.
const keySets = new Map<string, JWTVerifyGetKey>();

function keySetFor(teamDomain: string): JWTVerifyGetKey {
  let set = keySets.get(teamDomain);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
      timeoutDuration: 3000,
    });
    keySets.set(teamDomain, set);
  }
  return set;
}

export async function verifyAccessRequest(
  headers: Headers,
  config: AccessConfig,
  getKey?: JWTVerifyGetKey,
): Promise<AccessResult> {
  if (config.mode === "dev-bypass") return { ok: true, email: null, subject: null, country: null, dev: true };
  if (config.mode === "misconfigured") return { ok: false, reason: "not_configured", detail: config.reason };

  const token = headers.get(ACCESS_JWT_HEADER)?.trim();
  if (!token) return { ok: false, reason: "missing_token" };

  try {
    const { payload } = await jwtVerify(token, getKey ?? keySetFor(config.teamDomain), {
      issuer: config.teamDomain,
      audience: config.audience,
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (config.allowedEmails.length > 0 && (!email || !config.allowedEmails.includes(email))) {
      return { ok: false, reason: "email_not_allowed" };
    }
    const country = typeof payload.country === "string" ? payload.country : headers.get("cf-ipcountry");
    return { ok: true, email, subject: typeof payload.sub === "string" ? payload.sub : null, country: country ?? null };
  } catch (error) {
    return { ok: false, reason: "invalid_token", detail: error instanceof Error ? error.name : "unknown" };
  }
}
