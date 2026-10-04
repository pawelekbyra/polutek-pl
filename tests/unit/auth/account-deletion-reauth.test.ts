/** F-12: account deletion needs re-authentication and cannot remove the last admin. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  prisma: {
    account: { findFirst: vi.fn() },
    session: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), count: vi.fn() },
  },
  verify: vi.fn(),
  getActorFromAuth: vi.fn(),
  auth: vi.fn(),
  rateLimit: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth/auth", () => ({ auth: { $context: Promise.resolve({ password: { verify: h.verify } }) } }));
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: h.getActorFromAuth }));
vi.mock("@/lib/auth/server", () => ({ auth: h.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: h.rateLimit }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: () => ({}) }));
vi.mock("@/lib/modules/users", () => ({ AccountDeletionCleanupUseCase: { execute: h.execute } }));

import { checkSensitiveReauth, isLastAdmin } from "@/lib/auth/reauth";
import { DELETE } from "@/app/api/user/account/route";

const NOW = new Date("2026-10-02T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.account.findFirst.mockResolvedValue({ password: "hash" });
  h.verify.mockResolvedValue(true);
});

describe("checkSensitiveReauth", () => {
  it("asks a password account for the password and verifies it", async () => {
    expect(await checkSensitiveReauth({ userId: "u1", sessionId: "s1", password: null })).toBe("PASSWORD_REQUIRED");
    h.verify.mockResolvedValueOnce(false);
    expect(await checkSensitiveReauth({ userId: "u1", sessionId: "s1", password: "nope" })).toBe("INVALID_PASSWORD");
    expect(await checkSensitiveReauth({ userId: "u1", sessionId: "s1", password: "right" })).toBe("ok");
    expect(h.verify).toHaveBeenLastCalledWith({ hash: "hash", password: "right" });
  });

  it("lets a Google-only account delete only right after a fresh sign-in", async () => {
    h.prisma.account.findFirst.mockResolvedValue(null);
    h.prisma.session.findUnique.mockResolvedValueOnce({ createdAt: new Date(NOW.getTime() - 5 * 60_000) });
    expect(await checkSensitiveReauth({ userId: "u1", sessionId: "s1", now: NOW })).toBe("ok");
    h.prisma.session.findUnique.mockResolvedValueOnce({ createdAt: new Date(NOW.getTime() - 3 * 3600_000) });
    expect(await checkSensitiveReauth({ userId: "u1", sessionId: "s1", now: NOW })).toBe("REAUTH_REQUIRED");
    expect(await checkSensitiveReauth({ userId: "u1", sessionId: null, now: NOW })).toBe("REAUTH_REQUIRED");
  });
});

describe("isLastAdmin", () => {
  it("is true only for the sole remaining admin", async () => {
    h.prisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    h.prisma.user.count.mockResolvedValueOnce(0);
    expect(await isLastAdmin("a1")).toBe(true);
    h.prisma.user.count.mockResolvedValueOnce(2);
    expect(await isLastAdmin("a1")).toBe(false);
    h.prisma.user.findUnique.mockResolvedValue({ role: "USER" });
    expect(await isLastAdmin("u1")).toBe(false);
  });
});

describe("DELETE /api/user/account", () => {
  const request = (body?: unknown) =>
    new NextRequest("http://localhost/api/user/account", { method: "DELETE", body: body ? JSON.stringify(body) : undefined });

  beforeEach(() => {
    h.getActorFromAuth.mockResolvedValue({ type: "user", userId: "u1" });
    h.auth.mockResolvedValue({ sessionId: "s1" });
    h.rateLimit.mockResolvedValue({ success: true });
    h.prisma.user.findUnique.mockResolvedValue({ role: "USER" });
    h.execute.mockResolvedValue({ ok: true });
  });

  it("rejects without the password and does not delete", async () => {
    const res = await DELETE(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "PASSWORD_REQUIRED" });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("rejects a wrong password", async () => {
    h.verify.mockResolvedValue(false);
    const res = await DELETE(request({ password: "bad" }));
    expect(res.status).toBe(403);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("asks a Google-only account with an old session to sign in again", async () => {
    h.prisma.account.findFirst.mockResolvedValue(null);
    h.prisma.session.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - 86_400_000) });
    const res = await DELETE(request({}));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "REAUTH_REQUIRED" });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("refuses to delete the last administrator", async () => {
    h.prisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    h.prisma.user.count.mockResolvedValue(0);
    const res = await DELETE(request({ password: "right" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "LAST_ADMIN" });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    h.rateLimit.mockResolvedValue({ success: false });
    expect((await DELETE(request({ password: "right" }))).status).toBe(429);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("deletes with the right password", async () => {
    const res = await DELETE(request({ password: "right" }));
    expect(res.status).toBe(200);
    expect(h.execute).toHaveBeenCalledTimes(1);
  });
});
