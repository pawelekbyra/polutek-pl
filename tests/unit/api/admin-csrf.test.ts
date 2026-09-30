import { describe, expect, it } from "vitest";
import { assertSameOrigin, checkAdminCsrf, getCsrfMode } from "@/lib/api/csrf";

const ENV = { NEXT_PUBLIC_APP_URL: "https://www.pawelperfect.pl", NODE_ENV: "production" };

function req(headers: Record<string, string>, method = "POST") {
  return { method, headers: new Headers(headers), nextUrl: { pathname: "/api/admin/x" } };
}

describe("assertSameOrigin", () => {
  it.each([
    ["origin equals request host", { origin: "https://www.pawelperfect.pl", host: "www.pawelperfect.pl" }, true],
    ["origin is configured www host, request host differs", { origin: "https://www.pawelperfect.pl", host: "internal.vercel" }, true],
    ["origin is apex variant of configured host", { origin: "https://pawelperfect.pl", host: "www.pawelperfect.pl" }, true],
    ["forwarded host matches origin", { origin: "https://preview.example.com", host: "x", "x-forwarded-host": "preview.example.com" }, true],
    ["foreign origin", { origin: "https://evil.example", host: "www.pawelperfect.pl" }, false],
    ["lookalike suffix origin", { origin: "https://www.pawelperfect.pl.evil.example", host: "www.pawelperfect.pl" }, false],
    ["null origin", { origin: "null", host: "www.pawelperfect.pl" }, false],
    ["garbage origin", { origin: "not a url", host: "www.pawelperfect.pl" }, false],
    ["localhost origin in production", { origin: "http://localhost:3000", host: "www.pawelperfect.pl" }, false],
    ["no origin, no sec-fetch-site", { host: "www.pawelperfect.pl" }, true],
    ["no origin, same-origin", { "sec-fetch-site": "same-origin" }, true],
    ["no origin, none", { "sec-fetch-site": "none" }, true],
    ["no origin, cross-site", { "sec-fetch-site": "cross-site" }, false],
    ["no origin, same-site", { "sec-fetch-site": "same-site" }, false],
    ["foreign origin even with same-origin sec-fetch", { origin: "https://evil.example", "sec-fetch-site": "same-origin", host: "www.pawelperfect.pl" }, false],
  ])("%s", (_name, headers, allowed) => {
    expect(assertSameOrigin(req(headers as Record<string, string>), ENV).ok).toBe(allowed);
  });

  it("allows localhost origin only in development", () => {
    const r = req({ origin: "http://localhost:3000", host: "127.0.0.1:3000" });
    expect(assertSameOrigin(r, { ...ENV, NODE_ENV: "development" }).ok).toBe(true);
    expect(assertSameOrigin(r, { ...ENV, NODE_ENV: "production" }).ok).toBe(false);
  });
});

describe("checkAdminCsrf", () => {
  const evil = { origin: "https://evil.example", host: "www.pawelperfect.pl" };

  it("ignores GET/HEAD", () => {
    expect(checkAdminCsrf(req(evil, "GET"), ENV)).toBeNull();
    expect(checkAdminCsrf(req(evil, "HEAD"), ENV)).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("blocks cross-origin %s with 403", (method) => {
    const res = checkAdminCsrf(req(evil, method), ENV);
    expect(res?.status).toBe(403);
    expect(res?.body.error).toBe("Forbidden");
  });

  it("passes same-origin mutations", () => {
    expect(checkAdminCsrf(req({ origin: "https://www.pawelperfect.pl", host: "www.pawelperfect.pl" }), ENV)).toBeNull();
  });

  it("report mode never blocks", () => {
    expect(getCsrfMode({ ADMIN_CSRF_MODE: "report" })).toBe("report");
    expect(checkAdminCsrf(req(evil), { ...ENV, ADMIN_CSRF_MODE: "report" })).toBeNull();
  });

  it("defaults to enforce for unknown values", () => {
    expect(getCsrfMode({})).toBe("enforce");
    expect(getCsrfMode({ ADMIN_CSRF_MODE: "off" })).toBe("enforce");
  });
});
