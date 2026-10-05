/** Front door in access mode: the verified e-mail decides, translators stay on their screens, no cookie needed. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ verify: vi.fn(), role: vi.fn(), sessionRole: vi.fn(), denied: vi.fn(async () => undefined) }));
vi.mock("@admin/lib/security/cf-access", async (orig) => ({ ...(await orig<typeof import("@admin/lib/security/cf-access")>()), verifyAccessRequest: m.verify }));
vi.mock("@admin/lib/auth/roles", async (orig) => ({ ...(await orig<typeof import("@admin/lib/auth/roles")>()), lookupRoleByEmail: m.role, lookupSessionRole: m.sessionRole }));
vi.mock("@admin/lib/auth/access-session", () => ({ recordAccessDenied: m.denied }));

import { proxy } from "../../../apps/admin/proxy";

const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(path, "https://admin.pawelperfect.com"), { method: init.method ?? "GET", headers: init.headers });
const ok = (email: string | null, extra: Record<string, unknown> = {}) => ({ ok: true, email, subject: "s", country: "PL", issuedAt: 1, expiresAt: 2, tokenId: "tok", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CF_ACCESS_TEAM_DOMAIN", "https://pawelperfect.cloudflareaccess.com");
  vi.stubEnv("CF_ACCESS_AUD", "aud");
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy in access mode", () => {
  it("lets the owner through and exposes the verified e-mail to the pages", async () => {
    m.verify.mockResolvedValue(ok("pawel.perfect@gmail.com"));
    m.role.mockResolvedValue("OWNER");
    const res = await proxy(req("/przychody"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-override-headers")).toContain("x-panel-access-email");
    expect(m.verify.mock.calls[0][1]).toMatchObject({ requireEmail: true, allowedEmails: ["pawel.perfect@gmail.com"] });
  });

  it("lets a first-time owner through (no account yet; the guard creates it)", async () => {
    m.verify.mockResolvedValue(ok("pawel.perfect@gmail.com"));
    m.role.mockResolvedValue(null);
    expect((await proxy(req("/"))).status).toBe(200);
  });

  it("refuses a token whose e-mail is not allowed with 403 and logs it once per token", async () => {
    m.verify.mockResolvedValue({ ok: false, reason: "email_not_allowed", email: "intruder@example.test", tokenId: "tok" });
    const res = await proxy(req("/"));
    expect(res.status).toBe(403);
    expect(m.denied).toHaveBeenCalledWith(expect.anything(), "email_not_allowed", "intruder@example.test", "tok");
  });

  it("closes owner screens and APIs to a translator, keeps the translation screens and /logowanie", async () => {
    m.verify.mockResolvedValue(ok("tl@example.test"));
    m.role.mockResolvedValue("TRANSLATOR");
    const page = await proxy(req("/przychody"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/tlumaczenia");
    expect((await proxy(req("/api/export/audit"))).status).toBe(403);
    expect((await proxy(req("/tlumaczenia/abc"))).status).toBe(200);
    expect((await proxy(req("/logowanie"))).status).toBe(200);
    expect(m.sessionRole).not.toHaveBeenCalled(); // no cookie lookup in access mode
  });

  it("still enforces CSRF on mutations", async () => {
    m.verify.mockResolvedValue(ok("pawel.perfect@gmail.com"));
    m.role.mockResolvedValue("OWNER");
    const bad = await proxy(req("/przychody", { method: "POST", headers: { origin: "https://www.pawelperfect.com", "sec-fetch-site": "same-site" } }));
    expect(bad.status).toBe(403);
  });

  it("sets the CSP and no-store on pages, and /api/health stays open", async () => {
    m.verify.mockResolvedValue(ok("pawel.perfect@gmail.com"));
    m.role.mockResolvedValue("OWNER");
    const res = await proxy(req("/"));
    expect(res.headers.get("content-security-policy")).toContain("nonce-");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    m.verify.mockClear();
    expect((await proxy(req("/api/health"))).status).toBe(200);
    expect(m.verify).not.toHaveBeenCalled();
  });

  it("answers 503 when Access is not configured in production", async () => {
    vi.stubEnv("CF_ACCESS_AUD", "");
    m.verify.mockResolvedValue({ ok: false, reason: "not_configured" });
    expect((await proxy(req("/"))).status).toBe(503);
  });
});

describe("proxy in legacy passkey mode", () => {
  beforeEach(() => vi.stubEnv("ADMIN_AUTH_MODE", "passkey"));

  it("uses the session cookie to keep a translator on its screens, never the e-mail lookup", async () => {
    m.verify.mockResolvedValue(ok("tl@example.test"));
    m.sessionRole.mockResolvedValue("TRANSLATOR");
    const res = await proxy(req("/przychody", { headers: { cookie: "__Host-ppadm.session_token=abc" } }));
    expect(res.status).toBe(307);
    expect(m.role).not.toHaveBeenCalled();
    expect(m.verify.mock.calls[0][1]).toMatchObject({ requireEmail: false, allowedEmails: [] });
  });
});
