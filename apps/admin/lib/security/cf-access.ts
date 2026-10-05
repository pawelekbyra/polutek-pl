/**
 * Layer 1: Cloudflare Access. Access sits in front of the tunnel and adds a signed JWT to every request
 * (`Cf-Access-Jwt-Assertion`). The panel verifies it itself (RS256 signature against the team's public
 * keys, `iss` = team domain, `aud` = this application's AUD tag, `exp`), so a misconfigured tunnel
 * ingress or an exposed port still cannot reach the panel without passing Access.
 * Source: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */
import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AccessConfig } from "@admin/lib/config";

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export type AccessResult =
  | { ok: true; email: string | null; subject: string | null; country: string | null; issuedAt: number | null; expiresAt: number | null; tokenId: string | null; dev?: true }
  | { ok: false; reason: "missing_token" | "invalid_token" | "email_not_allowed" | "missing_email" | "not_configured"; detail?: string; email?: string | null; tokenId?: string | null };

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
  if (config.mode === "dev-bypass") return { ok: true, email: null, subject: null, country: null, issuedAt: null, expiresAt: null, tokenId: null, dev: true };
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
    // The e-mail comes ONLY from the verified payload, never from Cf-Access-Authenticated-User-Email or any other header.
    const email = typeof payload.email === "string" && payload.email.includes("@") ? payload.email.trim().toLowerCase() : null;
    const tokenId = tokenFingerprint(token);
    if (config.requireEmail && !email) return { ok: false, reason: "missing_email", tokenId };
    if (config.allowedEmails.length > 0 && (!email || !config.allowedEmails.includes(email))) {
      return { ok: false, reason: "email_not_allowed", email, tokenId };
    }
    const country = typeof payload.country === "string" ? payload.country : headers.get("cf-ipcountry");
    return {
      ok: true,
      email,
      subject: typeof payload.sub === "string" ? payload.sub : null,
      country: country ?? null,
      issuedAt: typeof payload.iat === "number" ? payload.iat : null,
      expiresAt: typeof payload.exp === "number" ? payload.exp : null,
      tokenId,
    };
  } catch (error) {
    return { ok: false, reason: "invalid_token", detail: error instanceof Error ? error.name : "unknown" };
  }
}

/** Short, non-reversible id of a token (audit and de-duplication; the token itself is never stored or logged). */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}
