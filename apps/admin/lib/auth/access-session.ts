import { randomUUID } from "node:crypto";
import type { JWTVerifyGetKey } from "jose";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ADMIN_ACCESS_MAX_AGE_SECONDS, getAccessConfig, getDevAccessEmail, getOwnerEmail, type Env } from "@admin/lib/config";
import { verifyAccessRequest, type AccessResult } from "@admin/lib/security/cf-access";
import { recordAdminAuthEvent } from "./audit";
import { normalizeRole, type AdminRole } from "./roles";

/**
 * ADMIN_AUTH_MODE=access: the verified Cloudflare Access JWT IS the sign-in.
 *
 * Stateless by design: no panel cookie, no AdminSession row. Every request carries `Cf-Access-Jwt-Assertion`;
 * we verify it again here (signature, issuer, audience, expiry: cf-access.ts), take the e-mail from the
 * VERIFIED payload only, require it to be allowed, and map it to an AdminUser. Reasons: nothing new to steal
 * or to keep in sync, sign-out and the 12 h bound are Cloudflare's (the token dies with the Access session),
 * and a request that skipped the proxy still cannot act without a valid token.
 *
 * Mapping by e-mail: an existing AdminUser keeps its role (OWNER or TRANSLATOR with language grants); only the
 * owner address (ADMIN_OWNER_EMAIL, default pawel.perfect@gmail.com) is created on first login, as OWNER.
 * Any other allowed address without an account is refused (translators are created by `admin-enroll`).
 */
export type AccessUser = { id: string; email: string; name: string; role: AdminRole };
export type AccessSession = {
  user: AccessUser;
  /** Unix seconds from the verified token (null only for the local dev bypass). */
  issuedAt: number | null;
  expiresAt: number | null;
  tokenId: string | null;
  country: string | null;
  dev: boolean;
};
export type AccessSessionResult =
  | { ok: true; session: AccessSession }
  | { ok: false; reason: "access_denied" | "no_account" | "not_configured" | "error"; email?: string | null };

export type ResolveOptions = { env?: Env; getKey?: JWTVerifyGetKey; record?: boolean };

const SEEN_MAX = 500;
const seenTokens = new Map<string, number>(); // tokenId -> first seen (ms); bounded, per process
const deniedTokens = new Map<string, number>();

function remember(map: Map<string, number>, key: string): boolean {
  if (map.has(key)) return false;
  if (map.size >= SEEN_MAX) map.delete(map.keys().next().value as string);
  map.set(key, Date.now());
  return true;
}

/** Test hook: forget which tokens were already logged. */
export function resetAccessSessionMemory() {
  seenTokens.clear();
  deniedTokens.clear();
}

async function mapEmailToUser(email: string, env: Env): Promise<AccessUser | null> {
  const select = { id: true, email: true, name: true, role: true } as const;
  const existing = await prisma.adminUser.findUnique({ where: { email }, select });
  if (existing) return { ...existing, role: normalizeRole(existing.role) };
  if (email !== getOwnerEmail(env)) return null;
  try {
    const created = await prisma.adminUser.create({ data: { id: randomUUID(), email, name: "Właściciel", emailVerified: true, role: "OWNER" }, select });
    return { ...created, role: "OWNER" };
  } catch (error) {
    // Two first requests at once: the loser reads what the winner created (idempotent).
    const again = await prisma.adminUser.findUnique({ where: { email }, select });
    if (again) return { ...again, role: normalizeRole(again.role) };
    throw error;
  }
}

/** One AdminAuthEvent per NEW Access token (not per request); survives restarts through the reason fingerprint. */
async function recordAccessSignIn(user: AccessUser, tokenId: string, issuedAt: number | null, headers: Headers) {
  if (!remember(seenTokens, tokenId)) return;
  const reason = `access token ${tokenId} iat ${issuedAt ?? "?"}`;
  try {
    const known = await prisma.adminAuthEvent.findFirst({ where: { action: "ADMIN_ACCESS_SIGN_IN", adminUserId: user.id, reason }, select: { id: true } });
    if (known) return;
  } catch (error) {
    logger.error("[admin-access] could not check the sign-in log", error);
  }
  await recordAdminAuthEvent({ action: "ADMIN_ACCESS_SIGN_IN", outcome: "success", adminUserId: user.id, email: user.email, reason, headers });
}

/** A validly signed token whose e-mail is not allowed (or has no account): logged once per token. */
export async function recordAccessDenied(headers: Headers, reason: string, email: string | null | undefined, tokenId: string | null | undefined) {
  if (!tokenId || !remember(deniedTokens, tokenId)) return;
  await recordAdminAuthEvent({ action: "ADMIN_ACCESS_DENIED", outcome: "failure", email: email ?? null, reason: `${reason} token ${tokenId}`, headers });
}

/** Identity of this request in access mode, or why not. Never throws. */
export async function resolveAccessSession(headers: Headers, opts: ResolveOptions = {}): Promise<AccessSessionResult> {
  const env = opts.env ?? process.env;
  const config = getAccessConfig(env);
  const verified: AccessResult = await verifyAccessRequest(headers, config, opts.getKey);
  if (!verified.ok) {
    if (verified.reason === "not_configured") return { ok: false, reason: "not_configured" };
    if (verified.reason === "email_not_allowed" || verified.reason === "missing_email") {
      if (opts.record !== false) await recordAccessDenied(headers, verified.reason, verified.email, verified.tokenId).catch(() => undefined);
    }
    return { ok: false, reason: "access_denied", email: verified.email ?? null };
  }
  const dev = verified.dev === true;
  const email = dev ? getDevAccessEmail(env) : verified.email;
  if (!email) return { ok: false, reason: "access_denied" };
  try {
    const user = await mapEmailToUser(email, env);
    if (!user) {
      if (opts.record !== false) await recordAccessDenied(headers, "no_account", email, verified.tokenId).catch(() => undefined);
      return { ok: false, reason: "no_account", email };
    }
    if (opts.record !== false && verified.tokenId) await recordAccessSignIn(user, verified.tokenId, verified.issuedAt, headers);
    return { ok: true, session: { user, issuedAt: verified.issuedAt, expiresAt: verified.expiresAt, tokenId: verified.tokenId, country: verified.country, dev } };
  } catch (error) {
    logger.error("[admin-access] could not map the Access identity to an account", error);
    return { ok: false, reason: "error", email };
  }
}

/**
 * Sensitive actions (money, delete, export, role change) need a token issued within ADMIN_ACCESS_MAX_AGE_SECONDS
 * (12 h). For a correctly configured Access application (session 12 h) that is always true; it only fails when
 * the Access session was stretched to days, and then the owner signs in again at Cloudflare. The local dev bypass has
 * no token and counts as fresh.
 */
export function isAccessTokenFresh(session: Pick<AccessSession, "issuedAt" | "dev">, now: number = Date.now()): boolean {
  if (session.dev) return true;
  if (session.issuedAt === null) return false;
  return now / 1000 - session.issuedAt <= ADMIN_ACCESS_MAX_AGE_SECONDS;
}

export function accessSecondsLeft(session: Pick<AccessSession, "issuedAt" | "dev">, now: number = Date.now()): number {
  if (session.issuedAt === null) return 0;
  return Math.max(0, Math.ceil(session.issuedAt + ADMIN_ACCESS_MAX_AGE_SECONDS - now / 1000));
}
