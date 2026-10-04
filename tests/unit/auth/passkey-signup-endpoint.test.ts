import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    account: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth/emails", () => ({
  queueVerificationEmail: vi.fn(),
  queuePasswordResetEmail: vi.fn(),
  queuePasswordChangedEmail: vi.fn(),
  queueChangeEmailConfirmation: vi.fn(),
  onEmailVerified: vi.fn(),
}));
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("@/lib/auth/rate-limit-storage", () => ({
  authRateLimitStorage: { consume: vi.fn() },
  hitAuthCounter: vi.fn(),
  peekAuthCounter: vi.fn().mockResolvedValue(0),
}));

const SECRET = "z".repeat(40);

async function loadAuth() {
  vi.resetModules();
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TURNSTILE_SECRET_KEY", "BETTER_AUTH_URL", "BETTER_AUTH_TRUSTED_ORIGINS"]) vi.stubEnv(key, "");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.pawelperfect.com");
  const [{ auth }, signup] = await Promise.all([import("@/lib/auth/auth"), import("@/lib/auth/passkey-signup")]);
  const api = auth.api as unknown as { startPasskeySignup: (input: { body: unknown }) => Promise<{ token: string }> };
  return { api, signup };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.user.findUnique.mockResolvedValue(null);
  h.prisma.account.findMany.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /passkey-signup/start", () => {
  it("issues a short-lived signed token for a free address, with a safe return path", async () => {
    const { api, signup } = await loadAuth();
    const { token } = await api.startPasskeySignup({ body: { email: " New@Example.com ", language: "pl", callbackURL: "//evil.example/x" } });
    const claims = signup.verifyPasskeySignupToken(token, SECRET);
    expect(claims).toMatchObject({ email: "new@example.com", language: "pl", callbackURL: "/" });
    expect(claims!.exp - Date.now() / 1000).toBeLessThanOrEqual(signup.PASSKEY_SIGNUP_TOKEN_TTL_SECONDS);
  });

  it("says plainly that the address already has an account (EMAIL_TAKEN decision), nothing more", async () => {
    const { api } = await loadAuth();
    h.prisma.user.findUnique.mockResolvedValue({ id: "u1" });
    h.prisma.account.findMany.mockResolvedValue([{ providerId: "credential" }]);
    await expect(api.startPasskeySignup({ body: { email: "taken@example.com" } })).rejects.toMatchObject({ body: { code: "EMAIL_TAKEN" } });
    h.prisma.account.findMany.mockResolvedValue([{ providerId: "google" }]);
    await expect(api.startPasskeySignup({ body: { email: "taken@example.com" } })).rejects.toMatchObject({ body: { code: "EMAIL_TAKEN_GOOGLE" } });
  });

  it("rejects something that is not an e-mail address", async () => {
    const { api } = await loadAuth();
    await expect(api.startPasskeySignup({ body: { email: "nope" } })).rejects.toMatchObject({ body: { code: "INVALID_EMAIL" } });
  });
});
