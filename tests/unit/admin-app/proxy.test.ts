import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../../apps/admin/proxy";

const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(path, "https://admin.pawelperfect.com"), { method: init.method ?? "GET", headers: init.headers });

afterEach(() => vi.unstubAllEnvs());

describe("admin proxy (front door)", () => {
  it("answers the container healthcheck without Access", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await proxy(req("/api/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed with 503 when Access is not configured in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CF_ACCESS_TEAM_DOMAIN", "");
    vi.stubEnv("CF_ACCESS_AUD", "");
    const res = await proxy(req("/"));
    expect(res.status).toBe(503);
  });

  it("refuses a request without the Access JWT, even with a session cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CF_ACCESS_TEAM_DOMAIN", "https://pawelperfect.cloudflareaccess.com");
    vi.stubEnv("CF_ACCESS_AUD", "aud");
    const res = await proxy(req("/system", { headers: { cookie: "__Host-ppadm.session_token=x" } }));
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Cloudflare Access");
  });

  it("refuses an invalid Access JWT", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CF_ACCESS_TEAM_DOMAIN", "https://pawelperfect.cloudflareaccess.com");
    vi.stubEnv("CF_ACCESS_AUD", "aud");
    const res = await proxy(req("/", { headers: { "cf-access-jwt-assertion": "a.b.c" } }));
    expect(res.status).toBe(403);
  });

  describe("in local development with the Access bypass", () => {
    it("sets a per-request nonce CSP and no-store on pages", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_DEV_BYPASS_ACCESS", "1");
      const a = await proxy(req("/"));
      const b = await proxy(req("/"));
      const csp = a.headers.get("content-security-policy") ?? "";
      expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(csp).not.toBe(b.headers.get("content-security-policy"));
      expect(a.headers.get("cache-control")).toBe("private, no-store");
    });

    it("rejects a cross-origin mutation (CSRF from www)", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_DEV_BYPASS_ACCESS", "1");
      vi.stubEnv("ADMIN_APP_URL", "https://admin.pawelperfect.com");
      const res = await proxy(req("/api/auth/sign-out", { method: "POST", headers: { origin: "https://www.pawelperfect.com", "sec-fetch-site": "same-site" } }));
      expect(res.status).toBe(403);
      const ok = await proxy(req("/api/auth/sign-out", { method: "POST", headers: { origin: "https://admin.pawelperfect.com", "sec-fetch-site": "same-origin" } }));
      expect(ok.status).toBe(200);
    });
  });
});
