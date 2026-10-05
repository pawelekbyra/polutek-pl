import { prisma } from "@/lib/prisma";
import { canonicalEventString, chainHash, recordAdminAuthEvent } from "./audit";

/**
 * "Bezpieczeństwo" data of the panel itself: live sessions, the sign-in log and a check of its hash chain.
 * Lives in lib/auth because only this layer touches the Admin* tables. Never returns tokens.
 */
export type AdminSessionView = { id: string; adminUserId: string; email: string; createdAt: string; lastSeenAt: string; expiresAt: string; ip: string | null; userAgent: string | null; stepUpAt: string | null };

export async function listAdminSessions(now: Date = new Date()): Promise<AdminSessionView[]> {
  const rows = await prisma.adminSession.findMany({ where: { expiresAt: { gt: now } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, userId: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true, stepUpAt: true, user: { select: { email: true } } } });
  return rows.map((r) => ({ id: r.id, adminUserId: r.userId, email: r.user.email, createdAt: r.createdAt.toISOString(), lastSeenAt: r.updatedAt.toISOString(), expiresAt: r.expiresAt.toISOString(), ip: r.ipAddress, userAgent: r.userAgent, stepUpAt: r.stepUpAt?.toISOString() ?? null }));
}

/** Short device name from a user agent string ("Chrome na Windows"); the raw string never reaches the page. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "nieznane urządzenie";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "przeglądarka";
  const os = /iPhone|iPad/.test(userAgent) ? "iOS" : /Android/.test(userAgent) ? "Android" : /Windows/.test(userAgent) ? "Windows" : /Mac OS X/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return os ? `${browser} na ${os}` : browser;
}

export type RevokeResult = { ok: true; revoked: number } | { ok: false; reason: "not_found" | "current_session" };

/** Ends one session (not the one making the request: that one signs out normally). Audited in AdminAuthEvent. */
export async function revokeAdminSession(input: { sessionId: string; actorUserId: string; currentSessionId?: string; headers?: Headers | null }): Promise<RevokeResult> {
  if (input.sessionId === input.currentSessionId) return { ok: false, reason: "current_session" };
  const target = await prisma.adminSession.findUnique({ where: { id: input.sessionId }, select: { id: true, userId: true } });
  if (!target) return { ok: false, reason: "not_found" };
  const { count } = await prisma.adminSession.deleteMany({ where: { id: target.id } });
  await recordAdminAuthEvent({ action: "ADMIN_SESSION_REVOKED", outcome: "success", adminUserId: input.actorUserId, reason: `session of ${target.userId}`, headers: input.headers });
  return { ok: true, revoked: count };
}

/** Ends every session of every panel account except the current one ("Wyloguj inne"). */
export async function revokeOtherAdminSessions(input: { actorUserId: string; currentSessionId?: string; headers?: Headers | null }): Promise<number> {
  const { count } = await prisma.adminSession.deleteMany({ where: input.currentSessionId ? { id: { not: input.currentSessionId } } : {} });
  await recordAdminAuthEvent({ action: "ADMIN_SESSION_REVOKED", outcome: "success", adminUserId: input.actorUserId, reason: `all other sessions (${count})`, headers: input.headers });
  return count;
}

export type AuthEventFilters = { outcome?: "success" | "failure"; action?: string; page?: number };
export type AuthEventView = { id: string; seq: number; at: string; action: string; outcome: string; email: string | null; reason: string | null; ip: string | null; country: string | null; device: string; requestId: string | null };
export const AUTH_EVENT_PAGE = 25;

export async function listAdminAuthEvents(f: AuthEventFilters): Promise<{ rows: AuthEventView[]; total: number; page: number; totalPages: number; failures24h: number }> {
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const where = { ...(f.outcome ? { outcome: f.outcome } : {}), ...(f.action ? { action: f.action } : {}) };
  const [total, rows, failures24h] = await Promise.all([
    prisma.adminAuthEvent.count({ where }),
    prisma.adminAuthEvent.findMany({ where, orderBy: { seq: "desc" }, skip: (page - 1) * AUTH_EVENT_PAGE, take: AUTH_EVENT_PAGE }),
    prisma.adminAuthEvent.count({ where: { outcome: "failure", createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  return {
    rows: rows.map((r) => ({ id: r.id, seq: Number(r.seq), at: r.createdAt.toISOString(), action: r.action, outcome: r.outcome, email: r.email, reason: r.reason, ip: r.ip, country: r.country, device: describeDevice(r.userAgent), requestId: r.requestId })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / AUTH_EVENT_PAGE)),
    failures24h,
  };
}

export type ChainCheck = { checked: number; ok: boolean; brokenAtSeq: number | null };

/** Recomputes the hashes of the newest rows and checks each row points at the one before it. */
export async function verifyAdminAuthChain(limit = 200): Promise<ChainCheck> {
  const rows = await prisma.adminAuthEvent.findMany({ orderBy: { seq: "desc" }, take: limit });
  const ordered = [...rows].reverse();
  for (let i = 0; i < ordered.length; i++) {
    const r = ordered[i];
    if (chainHash(r.prevHash, canonicalEventString(r)) !== r.hash) return { checked: i + 1, ok: false, brokenAtSeq: Number(r.seq) };
    if (i > 0 && r.prevHash !== ordered[i - 1].hash) return { checked: i + 1, ok: false, brokenAtSeq: Number(r.seq) };
  }
  return { checked: ordered.length, ok: true, brokenAtSeq: null };
}

export const EVENT_LABEL: Record<string, string> = {
  ADMIN_SIGN_IN: "Logowanie", ADMIN_SIGN_OUT: "Wylogowanie", ADMIN_STEP_UP: "Potwierdzenie tożsamości", ADMIN_SESSION_EXPIRED: "Sesja wygasła (12 h)", ADMIN_SESSION_REVOKED: "Sesja zakończona z panelu",
  ADMIN_PASSKEY_ADDED: "Dodano klucz dostępu", ADMIN_TOTP_ENABLED: "Włączono TOTP", ADMIN_ENROLLED: "Rejestracja ukończona", ADMIN_ENROLL_ISSUED: "Wydano link rejestracji (serwer)", ADMIN_ENROLL_RESET: "Reset dostępu (serwer)", ADMIN_ENROLL_REDEEMED: "Otwarto link rejestracji", ADMIN_ACCESS_DENIED: "Odmowa dostępu",
};
