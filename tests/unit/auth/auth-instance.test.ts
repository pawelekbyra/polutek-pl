import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Importing Better Auth and its plugins is slow on a cold, busy machine.
vi.setConfig({ testTimeout: 30_000 });

const sendEmail = vi.hoisted(() => ({
  queueVerificationEmail: vi.fn(),
  queuePasswordResetEmail: vi.fn(),
  queuePasswordChangedEmail: vi.fn(),
  queueChangeEmailConfirmation: vi.fn(),
  onEmailVerified: vi.fn(),
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
    expect(ids).toEqual(expect.arrayContaining(["captcha", "one-tap", "two-factor", "have-i-been-pwned", "passkey"]));
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

type PasskeyPluginOptions = {
  rpID: string;
  rpName: string;
  origin: string[];
  authenticatorSelection: Record<string, unknown>;
  registration: {
    requireSession: boolean;
    resolveUser?: (input: { ctx: unknown; context: string | null }) => Promise<unknown>;
    afterVerification: (input: unknown) => Promise<unknown>;
  };
  authentication: { afterVerification: (input: unknown) => Promise<void> };
};

function passkeyOptions(options: AuthOptions) {
  const plugin = options.plugins.find((p) => p.id === "passkey") as { options?: PasskeyPluginOptions } | undefined;
  expect(plugin).toBeDefined();
  return plugin!.options!;
}

describe("Better Auth passkeys", () => {
  it("binds passkeys to pawelperfect.com and accepts only the www and apex origins", async () => {
    const options = passkeyOptions(await loadAuth(FULL_ENV));
    expect(options.rpID).toBe("pawelperfect.com");
    expect(options.rpName).toBe("Pawel Perfect");
    expect(options.origin).toEqual(["https://www.pawelperfect.com", "https://pawelperfect.com"]);
  });

  it("uses localhost as RP in development", async () => {
    const options = passkeyOptions(await loadAuth({ NODE_ENV: "development" }));
    expect(options.rpID).toBe("localhost");
    expect(options.origin).toEqual(["http://localhost:3000"]);
  });

  it("creates discoverable credentials; registration without a session needs a valid sign-up token", async () => {
    const options = passkeyOptions(await loadAuth(FULL_ENV));
    expect(options.authenticatorSelection).toEqual({ residentKey: "required", requireResidentKey: true, userVerification: "preferred" });
    // Passkey-first sign-up: no session, but resolveUser accepts only our signed token.
    expect(options.registration.requireSession).toBe(false);
    await expect(options.registration.resolveUser!({ ctx: { context: { secret: "s".repeat(40) } }, context: null })).rejects.toMatchObject({
      body: { code: "PASSKEY_SIGNUP_EXPIRED" },
    });
    await expect(options.registration.resolveUser!({ ctx: { context: { secret: "s".repeat(40) } }, context: "forged.token" })).rejects.toMatchObject({
      body: { code: "PASSKEY_SIGNUP_EXPIRED" },
    });
  });

  it("puts Turnstile and a sign-up-sized rate limit on the passkey sign-up step, not on passkey sign-in", async () => {
    const options = await loadAuth(FULL_ENV);
    const captchaPlugin = options.plugins.find((p) => p.id === "captcha") as { options?: { endpoints?: string[] } } | undefined;
    expect(captchaPlugin?.options?.endpoints).toContain("/passkey-signup/start");
    expect(captchaPlugin?.options?.endpoints).not.toContain("/passkey/verify-authentication");
    expect(captchaPlugin?.options?.endpoints).not.toContain("/passkey/generate-authenticate-options");
    expect(options.rateLimit.customRules["/passkey-signup/start"]).toEqual({ window: 3600, max: 10 });
    expect(options.plugins.map((p) => p.id)).toContain("passkey-signup");
  });

  it("refuses a passkey ceremony in which the device did not verify the user", async () => {
    const options = passkeyOptions(await loadAuth(FULL_ENV));
    await expect(options.authentication.afterVerification({ verification: { authenticationInfo: { userVerified: false } } })).rejects.toMatchObject({
      body: { code: "PASSKEY_USER_VERIFICATION_REQUIRED" },
    });
    await expect(options.authentication.afterVerification({ verification: { authenticationInfo: { userVerified: true } } })).resolves.toBeUndefined();
    await expect(options.registration.afterVerification({ verification: { registrationInfo: { userVerified: false } } })).rejects.toMatchObject({
      body: { code: "PASSKEY_USER_VERIFICATION_REQUIRED" },
    });
  });

  it("rate limits the passkey endpoints and disables renaming", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.rateLimit.customRules["/passkey/generate-authenticate-options"]).toEqual({ window: 60, max: 20 });
    expect(options.rateLimit.customRules["/passkey/verify-authentication"]).toEqual({ window: 60, max: 10 });
    for (const path of ["/passkey/generate-register-options", "/passkey/verify-registration", "/passkey/delete-passkey"]) {
      expect(options.rateLimit.customRules[path]).toEqual({ window: 3600, max: 20 });
    }
    expect(options.disabledPaths).toContain("/passkey/update-passkey");
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

  it("no longer sends an account-exists mail; after verification only the e-mail-change notice runs", async () => {
    const options = await loadAuth(FULL_ENV);
    expect(options.emailAndPassword.onExistingUserSignUp).toBeUndefined();
    const after = (options.emailVerification as { afterEmailVerification?: (u: unknown, r: unknown) => Promise<void> }).afterEmailVerification;
    await after?.({ id: "u1", email: "a@b.pl" }, null);
    expect(sendEmail.onEmailVerified).toHaveBeenCalledWith({ id: "u1", email: "a@b.pl" }, null);
  });

  it("asks the current address to approve an e-mail change (AUTH-02)", async () => {
    const options = (await loadAuth(FULL_ENV)) as unknown as {
      user: { changeEmail: { enabled: boolean; sendChangeEmailConfirmation?: (d: unknown) => Promise<void> } };
      rateLimit: { customRules: Record<string, unknown> };
    };
    expect(options.user.changeEmail.enabled).toBe(true);
    await options.user.changeEmail.sendChangeEmailConfirmation?.({ user: { email: "old@b.pl" }, newEmail: "new@b.pl", url: "https://x/v" });
    expect(sendEmail.queueChangeEmailConfirmation).toHaveBeenCalledWith({ email: "old@b.pl" }, "new@b.pl", "https://x/v");
    expect(options.rateLimit.customRules["/change-email"]).toEqual({ window: 3600, max: 10 });
  });

});
