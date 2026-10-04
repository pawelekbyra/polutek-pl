import { describe, expect, it } from "vitest";
import {
  CAPTCHA_ENDPOINTS,
  PASSKEY_RP_NAME,
  PASSWORD_MIN_LENGTH,
  getAdminEmails,
  getAuthBaseUrl,
  getPasskeyRelyingParty,
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

describe("passkey relying party (WebAuthn)", () => {
  it("uses the domain without www as RP ID and accepts both the www and the apex origin", () => {
    expect(getPasskeyRelyingParty({ NEXT_PUBLIC_APP_URL: "https://www.pawelperfect.com" })).toEqual({
      rpID: "pawelperfect.com",
      rpName: PASSKEY_RP_NAME,
      origin: ["https://www.pawelperfect.com", "https://pawelperfect.com"],
    });
    expect(PASSKEY_RP_NAME).toBe("Pawel Perfect");
  });

  it("gives the same RP ID when the app URL is the apex or comes from BETTER_AUTH_URL", () => {
    expect(getPasskeyRelyingParty({ NEXT_PUBLIC_APP_URL: "https://pawelperfect.com" }).rpID).toBe("pawelperfect.com");
    expect(getPasskeyRelyingParty({ BETTER_AUTH_URL: "https://www.pawelperfect.com/", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).rpID).toBe("pawelperfect.com");
  });

  it("uses localhost in development", () => {
    expect(getPasskeyRelyingParty({})).toEqual({ rpID: "localhost", rpName: PASSKEY_RP_NAME, origin: ["http://localhost:3000"] });
    expect(getPasskeyRelyingParty({ NEXT_PUBLIC_APP_URL: "http://localhost:3005" }).origin).toEqual(["http://localhost:3005"]);
  });

  it("accepts extra trusted origins only on the RP domain, never a foreign one", () => {
    const { origin } = getPasskeyRelyingParty({
      NEXT_PUBLIC_APP_URL: "https://www.pawelperfect.com",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://apptest.pawelperfect.com,https://evil.example,https://pawelperfect.com.evil.example",
    });
    expect(origin).toContain("https://apptest.pawelperfect.com");
    expect(origin).not.toContain("https://evil.example");
    expect(origin).not.toContain("https://pawelperfect.com.evil.example");
  });

  it("keeps Turnstile off passkey sign-in, but on the passkey sign-up step where an e-mail is typed", () => {
    expect(CAPTCHA_ENDPOINTS.some((path) => path.startsWith("/passkey/"))).toBe(false);
    expect(CAPTCHA_ENDPOINTS).toContain("/passkey-signup/start");
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
