import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  adminSession: { findUnique: vi.fn(), deleteMany: vi.fn(async () => ({ count: 1 })), findMany: vi.fn() },
  adminAuthEvent: { findMany: vi.fn(), count: vi.fn(async () => 0) },
}));
const authAudit = vi.hoisted(() => ({ recordAdminAuthEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@admin/lib/auth/audit", async () => ({ ...(await vi.importActual<object>("@admin/lib/auth/audit")), recordAdminAuthEvent: authAudit.recordAdminAuthEvent }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: vi.fn(async () => undefined) }));

import { canonicalEventString, chainHash } from "@admin/lib/auth/audit";
import { describeDevice, revokeAdminSession, revokeOtherAdminSessions, verifyAdminAuthChain } from "@admin/lib/auth/security";
import { exportAuditCsv, listAuditLog, listSiteAdmins } from "@/lib/modules/admin-security";
import type { AppContext } from "@/lib/modules/shared/app-context";

beforeEach(() => vi.clearAllMocks());

function makeRows(n: number, tamper?: number) {
  const rows = [];
  let prev: string | null = null;
  for (let i = 1; i <= n; i++) {
    const base = { id: `e${i}`, seq: BigInt(i), action: "ADMIN_SIGN_IN", outcome: "success", adminUserId: "a1", email: "o@x", reason: null, ip: "1.1.1.1", country: "PL", userAgent: "UA", requestId: `r${i}`, createdAt: new Date(2026, 9, 1, 10, i) };
    const hash = chainHash(prev, canonicalEventString(base));
    rows.push({ ...base, prevHash: prev, hash });
    prev = hash;
  }
  if (tamper !== undefined) rows[tamper] = { ...rows[tamper], ip: "6.6.6.6" };
  return rows.reverse(); // newest first, as the query returns them
}

describe("verifyAdminAuthChain", () => {
  it("accepts an intact chain", async () => {
    db.adminAuthEvent.findMany.mockResolvedValue(makeRows(5));
    expect(await verifyAdminAuthChain()).toEqual({ checked: 5, ok: true, brokenAtSeq: null });
  });
  it("finds a rewritten row", async () => {
    db.adminAuthEvent.findMany.mockResolvedValue(makeRows(5, 2));
    expect(await verifyAdminAuthChain()).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });
  it("finds a removed row (the next row no longer points at its predecessor)", async () => {
    const rows = makeRows(5);
    rows.splice(2, 1);
    db.adminAuthEvent.findMany.mockResolvedValue(rows);
    expect((await verifyAdminAuthChain()).ok).toBe(false);
  });
});

describe("revoking sessions", () => {
  it("never revokes the session making the request", async () => {
    expect(await revokeAdminSession({ sessionId: "s1", actorUserId: "a1", currentSessionId: "s1" })).toEqual({ ok: false, reason: "current_session" });
    expect(db.adminSession.deleteMany).not.toHaveBeenCalled();
  });
  it("deletes another session and records who did it", async () => {
    db.adminSession.findUnique.mockResolvedValue({ id: "s2", userId: "a2" });
    expect(await revokeAdminSession({ sessionId: "s2", actorUserId: "a1", currentSessionId: "s1" })).toEqual({ ok: true, revoked: 1 });
    expect(authAudit.recordAdminAuthEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ADMIN_SESSION_REVOKED", adminUserId: "a1" }));
    db.adminSession.findUnique.mockResolvedValue(null);
    expect(await revokeAdminSession({ sessionId: "gone", actorUserId: "a1" })).toEqual({ ok: false, reason: "not_found" });
  });
  it("'Wyloguj inne' keeps the current session", async () => {
    db.adminSession.deleteMany.mockResolvedValue({ count: 3 });
    expect(await revokeOtherAdminSessions({ actorUserId: "a1", currentSessionId: "s1" })).toBe(3);
    expect(db.adminSession.deleteMany).toHaveBeenCalledWith({ where: { id: { not: "s1" } } });
  });
  it("describes devices without exposing the raw user agent", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537")).toBe("Chrome na Windows");
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604")).toBe("Safari na iOS");
    expect(describeDevice(null)).toBe("nieznane urządzenie");
  });
});

const admin = { type: "admin", userId: "a1" } as const;
const mk = (prisma: object, actor: AppContext["actor"] = admin) => ({ actor, prisma, now: () => new Date("2026-10-05T12:00:00Z") }) as unknown as AppContext;

describe("audit log read model", () => {
  const row = { id: "x1", createdAt: new Date("2026-10-04T10:00:00Z"), action: "PAYMENT_REFUNDED", actorType: "admin", actorUserId: "a1", systemReason: null, targetType: "Payment", targetId: "p1", requestId: "ray", ip: "203.0.113.5", metadata: { before: 1 } };
  const prisma = () => ({
    auditLog: { count: vi.fn(async () => 61), findMany: vi.fn(async () => [row, { ...row, id: "x2", actorType: "system", actorUserId: null, systemReason: "cron" }]), groupBy: vi.fn(async () => [{ targetType: "Payment" }]) },
    adminUser: { findMany: vi.fn(async () => [{ id: "a1", email: "o@x.pl" }]) },
  });

  it("filters by actor type, target, dates and free text, paged by 30", async () => {
    const p = prisma();
    const r = await listAuditLog(mk(p), { q: "p1", actorType: "admin", targetType: "Payment", from: new Date("2026-10-01T00:00:00Z"), page: 2 });
    expect(r).toMatchObject({ total: 61, page: 2, totalPages: 3, targetTypes: ["Payment"] });
    expect(r.rows[0]).toMatchObject({ actorLabel: "o@x.pl", ip: "203.0.113.5" });
    expect(r.rows[1].actorLabel).toBeNull();
    const call = (p.auditLog.findMany.mock.calls[0] as unknown as [{ where: object; skip: number; take: number }])[0];
    expect(call.skip).toBe(30);
    expect(call.take).toBe(30);
    expect(call.where).toMatchObject({ actorType: "admin", targetType: "Payment", createdAt: { gte: expect.any(Date) } });
    await expect(listAuditLog(mk(p, { type: "user", userId: "u" }), {})).rejects.toThrow("Only admins");
  });

  it("export neutralizes formulas, includes the IP and writes one audit entry without the search text", async () => {
    const p = prisma();
    p.auditLog.findMany.mockResolvedValue([{ ...row, targetId: "=1+1" }]);
    const audit = await import("@/lib/modules/audit");
    const r = await exportAuditCsv(mk(p), { q: "secret-term" });
    expect(r.csv).toContain("'=1+1");
    expect(r.csv).toContain("203.0.113.5");
    const call = (audit.recordAuditEvent as unknown as { mock: { calls: [unknown, { action: string }][] } }).mock.calls.at(-1)!;
    expect(call[1].action).toBe("AUDIT_EXPORTED");
    expect(JSON.stringify(call[1])).not.toContain("secret-term");
  });

  it("lists ADMIN accounts of the site with 2FA, passkeys and live sessions", async () => {
    const p = {
      user: { findMany: vi.fn(async () => [{ id: "u1", email: "a@x", name: "A", twoFactorEnabled: true, _count: { passkeys: 0 } }, { id: "u2", email: "b@x", name: null, twoFactorEnabled: false, _count: { passkeys: 0 } }]) },
      session: { groupBy: vi.fn(async () => [{ userId: "u1", _count: { _all: 2 }, _max: { createdAt: new Date("2026-10-05T10:00:00Z") } }]) },
    };
    const r = await listSiteAdmins(mk(p));
    expect(r[0]).toMatchObject({ twoFactor: true, activeSessions: 2 });
    expect(r[1]).toMatchObject({ twoFactor: false, passkeys: 0, activeSessions: 0 });
  });
});
