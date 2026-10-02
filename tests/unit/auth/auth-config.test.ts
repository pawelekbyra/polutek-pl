import { describe, expect, it } from "vitest";
import {
  CAPTCHA_ENDPOINTS,
  PASSWORD_MIN_LENGTH,
  getAdminEmails,
  getAuthBaseUrl,
  getTrustedOrigins,
  isAdminEmail,
  isCaptchaConfigured,
  isGoogleConfigured,
} from "@/lib/auth/config";
import { createRouteMatcher } from "@/lib/auth/route-matcher";

describe("auth config helpers", () => {
  it("uses BETTER_AUTH_URL over NEXT_PUBLIC_APP_URL and strips trailing slashes", () => {
    expect(getAuthBaseUrl({ BETTER_AUTH_URL: "https://a.example/", NEXT_PUBLIC_APP_URL: "https://b.example" })).toBe("https://a.example");
    expect(getAuthBaseUrl({ NEXT_PUBLIC_APP_URL: "https://www.pawelperfect.com/" })).toBe("https://www.pawelperfect.com");
    expect(getAuthBaseUrl({})).toBe("http://localhost:3000");
  });

  it("trusts www and apex of the app URL plus explicit extras", () => {
    const origins = getTrustedOrigins({
      NEXT_PUBLIC_APP_URL: "https://www.pawelperfect.com",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://apptest.pawelperfect.com/, ",
    });
    expect(origins).toEqual(
      expect.arrayContaining([
        "https://www.pawelperfect.com",
        "https://pawelperfect.com",
        "https://apptest.pawelperfect.com",
      ]),
    );
    expect(origins).not.toContain("https://evil.example");
  });

  it("does not invent www/apex variants for localhost", () => {
    expect(getTrustedOrigins({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toEqual(["http://localhost:3000"]);
  });

  it("parses the admin bootstrap list case-insensitively", () => {
    const env = { ADMIN_EMAILS: " Owner@Example.com ,hello@pawelperfect.com" };
    expect(getAdminEmails(env)).toEqual(["owner@example.com", "hello@pawelperfect.com"]);
    expect(isAdminEmail("OWNER@example.com", env)).toBe(true);
    expect(isAdminEmail("someone@example.com", env)).toBe(false);
    expect(isAdminEmail(null, env)).toBe(false);
    expect(getAdminEmails({})).toEqual([]);
  });

  it("detects configured providers", () => {
    expect(isGoogleConfigured({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" })).toBe(true);
    expect(isGoogleConfigured({ GOOGLE_CLIENT_ID: "a" })).toBe(false);
    expect(isCaptchaConfigured({ TURNSTILE_SECRET_KEY: "s" })).toBe(true);
    expect(isCaptchaConfigured({})).toBe(false);
  });

  it("keeps the password and captcha policy", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(CAPTCHA_ENDPOINTS).toEqual(
      expect.arrayContaining(["/sign-up/email", "/sign-in/email", "/request-password-reset", "/send-verification-email"]),
    );
  });
});

describe("createRouteMatcher", () => {
  const matches = createRouteMatcher(["/", "/api/auth(.*)", "/pl/watch/(.*)", "/api/videos/(.*)/thumbnail", "/manifest.json"]);

  it("matches exact paths and wildcards", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/api/auth/sign-in/email")).toBe(true);
    expect(matches("/api/auth")).toBe(true);
    expect(matches("/pl/watch/abc")).toBe(true);
    expect(matches("/api/videos/42/thumbnail")).toBe(true);
  });

  it("does not match near misses or treat dots as wildcards", () => {
    expect(matches("/pl/watch")).toBe(false);
    expect(matches("/admin")).toBe(false);
    expect(matches("/manifestXjson")).toBe(false);
    expect(matches("/api/videos/42/other")).toBe(false);
  });
});
