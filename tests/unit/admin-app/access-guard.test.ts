/** Page/route guards in access mode and the legacy passkey mode (switch with ADMIN_AUTH_MODE). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  resolve: vi.fn(),
  getSession: vi.fn(),
  grants: vi.fn(async () => ["de"]),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-access-jwt-assertion": "x" }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));
vi.mock("@admin/lib/auth/auth", () => ({ adminAuth: { api: { getSession: h.getSession, revokeSession: vi.fn(async () => undefined) } } }));
vi.mock("@admin/lib/auth/audit", () => ({ recordAdminAuthEvent: vi.fn() }));
vi.mock("@admin/lib/auth/roles", async (orig) => ({ ...(await orig<typeof import("@admin/lib/auth/roles")>()), loadLanguageGrants: h.grants, loadRole: vi.fn(async () => "OWNER") }));
vi.mock("@admin/lib/auth/access-session", async (orig) => ({ ...(await orig<typeof import("@admin/lib/auth/access-session")>()), resolveAccessSession: h.resolve }));

import { adminFromRequest } from "@admin/lib/auth/api-guard";
import { hasFreshStepUp, peekAdminSession, requireAdmin, requireStepUp } from "@admin/lib/auth/guard";

const nowS = () => Math.floor(Date.now() / 1000);
const okSession = (role: "OWNER" | "TRANSLATOR", issuedAt = nowS() - 30) => ({ ok: true, session: { user: { id: "u1", email: "pawel.perfect@gmail.com", name: "Właściciel", role }, issuedAt, expiresAt: issuedAt + 43200, tokenId: "t", country: "PL", dev: false } });
const redirectTarget = async (p: Promise<unknown>) => p.then(() => null, (e: { to?: string }) => e.to ?? "other");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());

describe("access mode (default)", () => {
  it("lets the verified owner in without any panel cookie or session row", async () => {
    h.resolve.mockResolvedValue(okSession("OWNER"));
    const v = await requireAdmin("/przychody");
    expect(v).toMatchObject({ userId: "u1", role: "OWNER", authMode: "access", signOutHref: "/cdn-cgi/access/logout", languages: [] });
    expect(h.getSession).not.toHaveBeenCalled();
  });

  it("sends a request without a valid identity to /logowanie (the explanation screen, no loop)", async () => {
    h.resolve.mockResolvedValue({ ok: false, reason: "access_denied" });
    expect(await redirectTarget(requireAdmin("/przychody"))).toBe("/logowanie?next=%2Fprzychody");
  });

  it("keeps a translator on the translation screens and grants languages", async () => {
    h.resolve.mockResolvedValue(okSession("TRANSLATOR"));
    expect(await redirectTarget(requireAdmin("/"))).toBe("/tlumaczenia");
    const v = await requireAdmin("/tlumaczenia", { roles: ["OWNER", "TRANSLATOR"] });
    expect(v).toMatchObject({ role: "TRANSLATOR", languages: ["de"] });
  });

  it("step-up = a fresh Access token (12 h); no passkey, TOTP or panel session is consulted", async () => {
    h.resolve.mockResolvedValue(okSession("OWNER", nowS() - 3600));
    expect(await hasFreshStepUp()).toBe(true);
    expect(await requireStepUp("/x")).toMatchObject({ userId: "u1" });
    h.resolve.mockResolvedValue(okSession("OWNER", nowS() - 13 * 3600));
    expect(await hasFreshStepUp()).toBe(false);
    expect(await redirectTarget(requireStepUp("/x"))).toBe("/potwierdz?next=%2Fx");
    h.resolve.mockResolvedValue({ ok: false, reason: "error" });
    expect(await hasFreshStepUp()).toBe(false);
    expect(h.getSession).not.toHaveBeenCalled();
  });

  it("route handlers: JSON-401 material (null) without identity or with the wrong role", async () => {
    const req = new Request("https://admin.pawelperfect.com/api/x");
    h.resolve.mockResolvedValue(okSession("OWNER"));
    expect(await adminFromRequest(req)).toEqual({ userId: "u1" });
    h.resolve.mockResolvedValue(okSession("TRANSLATOR"));
    expect(await adminFromRequest(req)).toBeNull();
    expect(await adminFromRequest(req, ["OWNER", "TRANSLATOR"])).toEqual({ userId: "u1" });
    h.resolve.mockResolvedValue({ ok: false, reason: "access_denied" });
    expect(await adminFromRequest(req)).toBeNull();
  });

  it("peek (login screen) reports an enrolled account for a verified identity", async () => {
    h.resolve.mockResolvedValue(okSession("OWNER"));
    expect(await peekAdminSession()).toEqual({ enrolled: true, email: "pawel.perfect@gmail.com" });
  });

  it("an unknown ADMIN_AUTH_MODE falls back to the STRICT legacy path, never to access", async () => {
    vi.stubEnv("ADMIN_AUTH_MODE", "acess");
    h.getSession.mockResolvedValue(null);
    expect(await redirectTarget(requireAdmin("/"))).toBe("/logowanie?next=%2F");
    expect(h.resolve).not.toHaveBeenCalled();
  });
});

describe("legacy passkey mode still works (ADMIN_AUTH_MODE=passkey)", () => {
  beforeEach(() => vi.stubEnv("ADMIN_AUTH_MODE", "passkey"));
  const session = (over: Record<string, unknown> = {}, userOver: Record<string, unknown> = {}) => ({
    session: { id: "s1", token: "tok", createdAt: new Date(), stepUpAt: null, ...over },
    user: { id: "u1", email: "pawel.perfect@gmail.com", name: "P", role: "OWNER", enrolledAt: new Date(), ...userOver },
  });

  it("requires the panel session, enrollment and the 12 h ceiling", async () => {
    h.getSession.mockResolvedValue(null);
    expect(await redirectTarget(requireAdmin("/a"))).toBe("/logowanie?next=%2Fa");
    h.getSession.mockResolvedValue(session({}, { enrolledAt: null }));
    expect(await redirectTarget(requireAdmin("/a"))).toBe("/rejestracja");
    h.getSession.mockResolvedValue(session({ createdAt: new Date(Date.now() - 13 * 3600_000) }));
    expect(await redirectTarget(requireAdmin("/a"))).toContain("powod=wygasla");
    h.getSession.mockResolvedValue(session());
    expect(await requireAdmin("/a")).toMatchObject({ userId: "u1", sessionId: "s1" });
    expect(h.resolve).not.toHaveBeenCalled();
  });

  it("step-up is the 5-minute passkey/TOTP window", async () => {
    h.getSession.mockResolvedValue(session());
    expect(await hasFreshStepUp()).toBe(true);
    h.getSession.mockResolvedValue(session({ createdAt: new Date(Date.now() - 600_000) }));
    expect(await hasFreshStepUp()).toBe(false);
    h.getSession.mockResolvedValue(session({ createdAt: new Date(Date.now() - 600_000), stepUpAt: new Date() }));
    expect(await hasFreshStepUp()).toBe(true);
  });

  it("route handlers read the Better Auth session, not the Access token", async () => {
    h.getSession.mockResolvedValue(session());
    expect(await adminFromRequest(new Request("https://x.test/api"))).toEqual({ userId: "u1" });
    expect(h.resolve).not.toHaveBeenCalled();
  });
});
