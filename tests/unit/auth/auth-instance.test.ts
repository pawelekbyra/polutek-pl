import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Importing Better Auth and its plugins is slow on a cold, busy machine.
vi.setConfig({ testTimeout: 30_000 });

const sendEmail = vi.hoisted(() => ({
  queueVerificationEmail: vi.fn(),
  queuePasswordResetEmail: vi.fn(),
  queuePasswordChangedEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth/emails", () => sendEmail);
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("@/lib/auth/rate-limit-storage", () => ({
  authRateLimitStorage: { consume: vi.fn() },
  hitAuthCounter: vi.fn(),
  peekAuthCounter: vi.fn(),
}));

type AuthOptions = {
  baseURL: string;
  trustedOrigins: string[];
  emailAndPassword: Record<string, unknown> & {
    onExistingUserSignUp?: unknown;
    sendResetPassword: (data: { user: { email: string }; url: string }) => Promise<void>;
  };
  emailVerification: { afterEmailVerification?: unknown; sendVerificationEmail: (data: { user: { email: string }; url: string }) => Promise<void> };
  socialProviders: { google?: { clientId: string; prompt?: string } };
  account: { accountLinking: { enabled: boolean; trustedProviders: string[]; requireLocalEmailVerified?: boolean } };
  session: { cookieCache: { enabled: boolean } };
  rateLimit: { enabled: boolean; customStorage: unknown; customRules: Record<string, unknown> };
  advanced: { cookiePrefix: string; useSecureCookies: boolean; defaultCookieAttributes: Record<string, unknown> };
  disabledPaths: string[];
  user: { fields: Record<string, string>; additionalFields: Record<string, unknown> };
  plugins: Array<{ id: string }>;
};

async function loadAuth(env: Record<string, string>) {
  vi.resetModules();
  // CI exports real-looking auth variables; start from a clean slate so each case is explicit.
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TURNSTILE_SECRET_KEY", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "BETTER_AUTH_TRUSTED_ORIGINS", "NEXT_PUBLIC_APP_URL"]) vi.stubEnv(key, "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const mod = await import("@/lib/auth/auth");
  return mod.auth.options as unknown as AuthOptions;
}

const FULL_ENV = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "x".repeat(40),
  NEXT_PUBLIC_APP_URL: "https://www.pawelperfect.com",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
};

beforeEach(() => {
  Object.values(sendEmail).forEach((fn) => fn.mockClear());
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Better Auth instance configuration", () => {
  it("wires Google, linking by trusted provider, One Tap, 2FA, captcha and breach checks", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.socialProviders.google?.clientId).toBe("google-id");
    // Shared computers: the Google account chooser is always shown.
    expect(options.socialProviders.google?.prompt).toBe("select_account");
    expect(options.account.accountLinking).toEqual({
      enabled: true,
      trustedProviders: ["google"],
      // F-04: Google may claim an address that only has a never-verified password sign-up.
      requireLocalEmailVerified: false,
    });
    const ids = options.plugins.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["captcha", "one-tap", "two-factor", "have-i-been-pwned"]));
    expect(ids[ids.length - 1]).toBe("next-cookies");
  });

  it("enforces the password policy and verified e-mail without auto sign-in", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 10,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    });
  });

  it("uses secure, HttpOnly, same-site cookies with our prefix in production", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.advanced.cookiePrefix).toBe("pp");
    expect(options.advanced.useSecureCookies).toBe(true);
    expect(options.advanced.defaultCookieAttributes).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true });
    expect(options.session.cookieCache.enabled).toBe(true);
  });

  it("trusts the www and apex origins", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.baseURL).toBe("https://www.pawelperfect.com");
    expect(options.trustedOrigins).toEqual(expect.arrayContaining(["https://www.pawelperfect.com", "https://pawelperfect.com"]));
  });

  it("rate limits on our own atomic storage with strict sign-in/sign-up rules", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.rateLimit.enabled).toBe(true);
    expect(options.rateLimit.customStorage).toBeDefined();
    expect(options.rateLimit.customRules["/sign-in/email"]).toEqual({ window: 60, max: 10 });
    expect(options.rateLimit.customRules["/request-password-reset"]).toBeDefined();
  });

  it("maps the nickname/avatar fields and disables Better Auth's own profile editing", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.user.fields).toEqual({ image: "imageUrl" });
    expect(Object.keys(options.user.additionalFields)).toEqual(expect.arrayContaining(["language", "onboardingPending"]));
    expect(options.disabledPaths).toContain("/update-user");
  });

  it("omits Google and captcha when they are not configured (development)", async () => {
    const options = await loadAuth({ NODE_ENV: "development" });
    expect(options.socialProviders.google).toBeUndefined();
    const ids = options.plugins.map((p) => p.id);
    expect(ids).not.toContain("captcha");
    expect(ids).not.toContain("one-tap");
    expect(ids).toContain("two-factor");
  });

  it("refuses to start in production without BETTER_AUTH_SECRET", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    await expect(import("@/lib/auth/auth")).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe("Better Auth e-mail callbacks", () => {
  it("sends the verification and reset links through the e-mail module", async () => {
    const options = await loadAuth(FULL_ENV);
    await options.emailVerification.sendVerificationEmail({ user: { email: "a@b.pl" }, url: "https://x/verify" });
    await options.emailAndPassword.sendResetPassword({ user: { email: "a@b.pl" }, url: "https://x/reset" });
    expect(sendEmail.queueVerificationEmail).toHaveBeenCalledWith({ email: "a@b.pl" }, "https://x/verify");
    expect(sendEmail.queuePasswordResetEmail).toHaveBeenCalledWith({ email: "a@b.pl" }, "https://x/reset");
  });

  it("no longer sends an account-exists mail and sends the welcome mail only at onboarding", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.emailAndPassword.onExistingUserSignUp).toBeUndefined();
    expect((options.emailVerification as Record<string, unknown>).afterEmailVerification).toBeUndefined();
  });

});
