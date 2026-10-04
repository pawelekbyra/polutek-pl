import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: { passkey: { findUnique: vi.fn() } },
  hooks: { existingAccountCode: vi.fn(), assertMailToAddressAllowed: vi.fn(), countMailToAddress: vi.fn() },
  sendVerificationEmailFn: vi.fn(),
  getSessionFromCtx: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth/hooks", () => h.hooks);
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  sendVerificationEmailFn: h.sendVerificationEmailFn,
  getSessionFromCtx: h.getSessionFromCtx,
}));

import {
  afterPasskeyAuthentication,
  afterPasskeyRegistration,
  isPendingPasskeySignupUser,
  normalizeSignupEmail,
  resolvePasskeySignupUser,
  signPasskeySignupToken,
  verifyPasskeySignupToken,
  type PasskeySignupClaims,
} from "@/lib/auth/passkey-signup";

const SECRET = "x".repeat(40);
const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);

function claims(overrides: Partial<PasskeySignupClaims> = {}): PasskeySignupClaims {
  return { email: "new@example.com", language: "pl", callbackURL: "/pl?verified=1", nonce: "n1", exp: NOW / 1000 + 600, ...overrides };
}

function regCtx() {
  return { context: { secret: SECRET, internalAdapter: { createUser: vi.fn().mockResolvedValue({ id: "u-new", email: "new@example.com", name: "new" }) } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  h.hooks.existingAccountCode.mockResolvedValue(null);
});

describe("sign-up token", () => {
  it("round-trips signed claims and rejects tampering, another secret and expiry", () => {
    const token = signPasskeySignupToken(claims(), SECRET);
    expect(verifyPasskeySignupToken(token, SECRET, NOW)).toEqual(claims());
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify(claims({ email: "victim@example.com" }))).toString("base64url");
    expect(verifyPasskeySignupToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
    expect(verifyPasskeySignupToken(`${payload}.${signature}x`, SECRET, NOW)).toBeNull();
    expect(verifyPasskeySignupToken(token, "y".repeat(40), NOW)).toBeNull();
    expect(verifyPasskeySignupToken(token, SECRET, NOW + 601_000)).toBeNull();
    expect(verifyPasskeySignupToken(null, SECRET, NOW)).toBeNull();
    expect(verifyPasskeySignupToken("a.b.c", SECRET, NOW)).toBeNull();
  });

  it("accepts only plausible e-mail addresses, lower-cased", () => {
    expect(normalizeSignupEmail("  New@Example.COM ")).toBe("new@example.com");
    expect(normalizeSignupEmail("no-at-sign")).toBeNull();
    expect(normalizeSignupEmail(`${"a".repeat(250)}@b.pl`)).toBeNull();
    expect(normalizeSignupEmail(42)).toBeNull();
  });
});

describe("registration without a session (passkey-first sign-up)", () => {
  it("resolves a pending user only from a valid token, named by the e-mail", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const token = signPasskeySignupToken(claims(), SECRET);
    const user = await resolvePasskeySignupUser({ ctx: { context: { secret: SECRET } }, context: token });
    expect(user).toEqual({ id: "passkey-signup:n1", name: "new@example.com", displayName: "new@example.com" });
    expect(isPendingPasskeySignupUser(user.id)).toBe(true);
    await expect(resolvePasskeySignupUser({ ctx: { context: { secret: SECRET } }, context: null })).rejects.toMatchObject({
      body: { code: "PASSKEY_SIGNUP_EXPIRED" },
    });
  });

  it("creates the unverified account only after the ceremony and mails the verification link", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const ctx = regCtx();
    const result = await afterPasskeyRegistration({
      ctx: ctx as never,
      verification: { registrationInfo: { userVerified: true } },
      user: { id: "passkey-signup:n1" },
      context: signPasskeySignupToken(claims(), SECRET),
    });
    expect(result).toEqual({ userId: "u-new" });
    expect(ctx.context.internalAdapter.createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      name: "new",
      emailVerified: false,
      language: "pl",
    });
    expect(h.sendVerificationEmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ body: { callbackURL: "/pl?verified=1" } }),
      expect.objectContaining({ id: "u-new" }),
    );
    expect(h.hooks.countMailToAddress).toHaveBeenCalledWith("new@example.com", undefined);
  });

  it("refuses when the device did not verify the user, before creating anything", async () => {
    const ctx = regCtx();
    await expect(
      afterPasskeyRegistration({ ctx: ctx as never, verification: { registrationInfo: { userVerified: false } }, user: { id: "passkey-signup:n1" }, context: "x" }),
    ).rejects.toMatchObject({ body: { code: "PASSKEY_USER_VERIFICATION_REQUIRED" } });
    expect(ctx.context.internalAdapter.createUser).not.toHaveBeenCalled();
  });

  it("answers EMAIL_TAKEN (as the e-mail sign-up does) when the address got an account meanwhile", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    h.hooks.existingAccountCode.mockResolvedValue("EMAIL_TAKEN_GOOGLE");
    const ctx = regCtx();
    await expect(
      afterPasskeyRegistration({
        ctx: ctx as never,
        verification: { registrationInfo: { userVerified: true } },
        user: { id: "passkey-signup:n1" },
        context: signPasskeySignupToken(claims(), SECRET),
      }),
    ).rejects.toMatchObject({ body: { code: "EMAIL_TAKEN_GOOGLE" } });
    expect(ctx.context.internalAdapter.createUser).not.toHaveBeenCalled();
  });

  it("refuses an expired or forged token at the end of the ceremony", async () => {
    const ctx = regCtx();
    await expect(
      afterPasskeyRegistration({ ctx: ctx as never, verification: { registrationInfo: { userVerified: true } }, user: { id: "passkey-signup:n1" }, context: "forged" }),
    ).rejects.toMatchObject({ body: { code: "PASSKEY_SIGNUP_EXPIRED" } });
  });

  it("adds a key to a signed-in account only while that session exists", async () => {
    h.getSessionFromCtx.mockResolvedValue({ session: { id: "s1" }, user: { id: "u1" } });
    await expect(
      afterPasskeyRegistration({ ctx: regCtx() as never, verification: { registrationInfo: { userVerified: true } }, user: { id: "u1" } }),
    ).resolves.toBeUndefined();
    h.getSessionFromCtx.mockResolvedValue(null);
    await expect(
      afterPasskeyRegistration({ ctx: regCtx() as never, verification: { registrationInfo: { userVerified: true } }, user: { id: "u1" } }),
    ).rejects.toMatchObject({ body: { code: "SESSION_REQUIRED" } });
  });
});

describe("passkey sign-in", () => {
  it("signs in a verified account (no TOTP step is added anywhere here)", async () => {
    h.prisma.passkey.findUnique.mockResolvedValue({ user: { id: "u1", email: "a@b.pl", emailVerified: true, isDeleted: false } });
    await expect(
      afterPasskeyAuthentication({ ctx: { context: { secret: SECRET } }, verification: { authenticationInfo: { userVerified: true } }, clientData: { id: "cred-1" } }),
    ).resolves.toBeUndefined();
    expect(h.sendVerificationEmailFn).not.toHaveBeenCalled();
  });

  it("refuses an account whose e-mail is not verified yet and sends a new link", async () => {
    h.prisma.passkey.findUnique.mockResolvedValue({ user: { id: "u1", email: "a@b.pl", emailVerified: false, isDeleted: false } });
    await expect(
      afterPasskeyAuthentication({ ctx: { context: { secret: SECRET } }, verification: { authenticationInfo: { userVerified: true } }, clientData: { id: "cred-1" } }),
    ).rejects.toMatchObject({ body: { code: "EMAIL_NOT_VERIFIED" } });
    expect(h.hooks.assertMailToAddressAllowed).toHaveBeenCalledWith("a@b.pl");
    expect(h.sendVerificationEmailFn).toHaveBeenCalled();
  });

  it("still refuses (without mailing) when the per-address mail limit is reached", async () => {
    h.prisma.passkey.findUnique.mockResolvedValue({ user: { id: "u1", email: "a@b.pl", emailVerified: false, isDeleted: false } });
    h.hooks.assertMailToAddressAllowed.mockRejectedValueOnce(new Error("TOO_MANY_ATTEMPTS"));
    await expect(
      afterPasskeyAuthentication({ ctx: { context: { secret: SECRET } }, verification: { authenticationInfo: { userVerified: true } }, clientData: { id: "cred-1" } }),
    ).rejects.toMatchObject({ body: { code: "EMAIL_NOT_VERIFIED" } });
    expect(h.sendVerificationEmailFn).not.toHaveBeenCalled();
  });
});
