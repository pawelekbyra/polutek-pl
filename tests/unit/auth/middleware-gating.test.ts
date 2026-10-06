import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import middleware from "@/middleware";

const ORIGIN = "https://www.pawelperfect.com";

function request(path: string, init: { method?: string; headers?: Record<string, string>; cookie?: string } = {}) {
  const headers = new Headers({ host: "www.pawelperfect.com", ...(init.headers ?? {}) });
  if (init.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(`${ORIGIN}${path}`, { method: init.method ?? "GET", headers });
}

const SESSION_COOKIE = "pp.session_token=abc.def";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
});

describe("proxy: public routes", () => {
  it.each(["/en", "/en/watch/some-video", "/api/auth/sign-in/email", "/api/auth/callback/google", "/api/auth/passkey/generate-authenticate-options", "/api/auth/passkey/verify-authentication", "/api/auth/passkey-signup/start", "/reset-password", "/sso-callback", "/api/webhooks/stripe", "/api/webhooks/ses", "/api/cron/x", "/api/users/nickname-available"])(
    "lets %s through without a session",
    async (path) => {
      const response = await middleware(request(path));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    },
  );

  it("does not rewrite the Better Auth return pages to /pl", async () => {
    for (const path of ["/sso-callback", "/reset-password"]) {
      const response = await middleware(request(path));
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("still rewrites other bare paths to the Polish locale", async () => {
    const response = await middleware(request("/regulamin"));
    expect(response.headers.get("x-middleware-rewrite")).toContain("/pl/regulamin");
  });

  it("serves the unsubscribe page at its own path (no /pl rewrite, no session needed)", async () => {
    const response = await middleware(request("/unsubscribe?token=abc"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it.each(["/", "/regulamin", "/polityka-prywatnosci", "/terms", "/privacy-policy", "/watch/some-video"])(
    "sends the security headers on the rewritten bare path %s",
    async (path) => {
      const response = await middleware(request(path));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-rewrite")).toContain("/pl");
      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    },
  );

  it("gates a non-public bare path like any other protected page", async () => {
    const response = await middleware(request("/profile"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("signin=1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("proxy: protected routes", () => {
  it("redirects a page without a session cookie to the sign-in modal", async () => {
    const response = await middleware(request("/pl/profile/settings?x=1"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("signin")).toBe("1");
    expect(location.searchParams.get("next")).toBe("/pl/profile/settings?x=1");
  });

  it("answers JSON 401 for API paths without a session cookie", async () => {
    const response = await middleware(request("/api/user/profile"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("lets a request with a session cookie continue (real validation happens in handlers)", async () => {
    const response = await middleware(request("/api/user/profile", { cookie: SESSION_COOKIE }));
    expect(response.status).toBe(200);
  });

  it("gates comment mutations but not comment reads", async () => {
    expect((await middleware(request("/api/comments"))).status).toBe(200);
    expect((await middleware(request("/api/comments", { method: "POST", headers: { origin: ORIGIN } }))).status).toBe(401);
    expect((await middleware(request("/api/comments", { method: "POST", headers: { origin: ORIGIN }, cookie: SESSION_COOKIE }))).status).toBe(200);
  });
});

describe("proxy: retired old admin (phase 5)", () => {
  it.each([
    ["/admin", "https://admin.pawelperfect.com/"],
    ["/admin/videos", "https://admin.pawelperfect.com/tresci"],
    ["/admin/users/payments", "https://admin.pawelperfect.com/przychody?tab=wplaty"],
    ["/admin/something/unknown", "https://admin.pawelperfect.com/"],
  ])("answers a permanent 308 for %s, with or without a session", async (path, target) => {
    for (const cookie of [undefined, SESSION_COOKIE]) {
      const response = await middleware(request(path, { cookie }));
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(target);
    }
  });

  it.each(["/api/admin", "/api/admin/users", "/api/admin/videos/abc/actions", "/api/admin/comments/x/hide"])(
    "answers 404 for the removed API %s on every method, with or without a session",
    async (path) => {
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
        for (const cookie of [undefined, SESSION_COOKIE]) {
          const response = await middleware(request(path, { method, cookie, headers: { origin: ORIGIN } }));
          expect(response.status).toBe(404);
        }
      }
    },
  );

  it("does not catch look-alike public paths", async () => {
    for (const path of ["/administracja", "/api/administrator", "/pl/admin-note"]) {
      const response = await middleware(request(path));
      expect(response.status).not.toBe(308);
      expect(response.status).not.toBe(404);
    }
  });
});

describe("proxy: account mutations", () => {
  it("blocks cross-origin account mutations (/api/user/*)", async () => {
    const response = await middleware(
      request("/api/user/nickname", { method: "PATCH", headers: { origin: "https://evil.example" }, cookie: SESSION_COOKIE }),
    );
    expect(response.status).toBe(403);
  });
});

describe("proxy: locale written in the URL (for <html lang>)", () => {
  const forwarded = (response: Response) => response.headers.get("x-middleware-request-x-pp-route-locale");

  it.each([["/en", "en"], ["/en/watch/some-video", "en"], ["/pl", "pl"], ["/pl/regulamin", "pl"]])(
    "passes %s on as %s",
    async (path, locale) => {
      expect(forwarded(await middleware(request(path)))).toBe(locale);
    },
  );

  it("passes nothing on for a bare path, whose language is negotiated, and drops a client-sent value", async () => {
    const response = await middleware(request("/", { headers: { "x-pp-route-locale": "en" } }));
    expect(response.headers.get("x-middleware-rewrite")).toContain("/pl");
    expect(forwarded(response)).toBeNull();
  });
});
