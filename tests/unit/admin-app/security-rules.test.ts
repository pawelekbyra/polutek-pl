import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@admin/lib/security/csp";
import { checkPanelCsrf } from "@admin/lib/security/csrf";
import { isAbsoluteExpired, isStepUpFresh, safeNextPath, stepUpSecondsLeft } from "@admin/lib/auth/session-rules";
import { resolveAdminAuthSecret } from "@admin/lib/config";

const ORIGIN = "https://admin.pawelperfect.com";

describe("panel CSP", () => {
  it("is strict in production: nonce + strict-dynamic, no inline, no external origins", () => {
    const csp = buildCsp("abc123");
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:\/\//);
  });

  it("relaxes only what next dev needs", () => {
    const csp = buildCsp("n", { dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("creates a fresh, unguessable nonce each time", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/=]{24}$/);
    expect(createNonce()).not.toBe(a);
  });
});

describe("panel CSRF", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it("lets reads through", () => {
    expect(checkPanelCsrf("GET", h({}), ORIGIN)).toEqual({ ok: true });
  });
  it("accepts a same-origin mutation", () => {
    expect(checkPanelCsrf("POST", h({ origin: ORIGIN, "sec-fetch-site": "same-origin" }), ORIGIN)).toEqual({ ok: true });
  });
  it("refuses a mutation sent from www (same site, different origin)", () => {
    expect(checkPanelCsrf("POST", h({ origin: "https://www.pawelperfect.com", "sec-fetch-site": "same-site" }), ORIGIN)).toEqual({ ok: false, reason: "cross_site" });
    expect(checkPanelCsrf("DELETE", h({ origin: "https://www.pawelperfect.com" }), ORIGIN)).toEqual({ ok: false, reason: "origin_mismatch" });
  });
  it("refuses a mutation without Origin", () => {
    expect(checkPanelCsrf("PATCH", h({}), ORIGIN)).toEqual({ ok: false, reason: "missing_origin" });
  });
});

describe("session rules", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  it("counts a sign-in or a TOTP step-up as fresh for 5 minutes", () => {
    expect(isStepUpFresh({ createdAt: new Date(now - 4 * 60_000) }, now)).toBe(true);
    expect(isStepUpFresh({ createdAt: new Date(now - 6 * 60_000) }, now)).toBe(false);
    expect(isStepUpFresh({ createdAt: new Date(now - 3600_000), stepUpAt: new Date(now - 60_000) }, now)).toBe(true);
    expect(stepUpSecondsLeft({ createdAt: new Date(now - 60_000) }, now)).toBe(240);
    expect(stepUpSecondsLeft({ createdAt: new Date(now - 600_000) }, now)).toBe(0);
  });
  it("ends every session 12 hours after sign-in", () => {
    expect(isAbsoluteExpired({ createdAt: new Date(now - 11 * 3600_000) }, now)).toBe(false);
    expect(isAbsoluteExpired({ createdAt: new Date(now - 12 * 3600_000 - 1000) }, now)).toBe(true);
  });
  it("keeps only same-site relative return paths", () => {
    expect(safeNextPath("/system?tab=serwer")).toBe("/system?tab=serwer");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "system", "/api/auth/sign-out", "/logowanie", null, ""]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});

describe("admin auth secret", () => {
  it("is required in production and must be long", () => {
    expect(() => resolveAdminAuthSecret({ NODE_ENV: "production" })).toThrow(/ADMIN_AUTH_SECRET/);
    expect(() => resolveAdminAuthSecret({ NODE_ENV: "production", ADMIN_AUTH_SECRET: "short" })).toThrow();
    expect(resolveAdminAuthSecret({ NODE_ENV: "production", ADMIN_AUTH_SECRET: "x".repeat(40) })).toBe("x".repeat(40));
  });
});
