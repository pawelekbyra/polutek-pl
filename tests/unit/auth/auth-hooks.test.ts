import { describe, expect, it, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  account: { deleteMany: vi.fn().mockReturnValue("delete-accounts"), findMany: vi.fn() },
  session: { deleteMany: vi.fn().mockReturnValue("delete-sessions") },
  passkey: { deleteMany: vi.fn().mockReturnValue("delete-passkeys") },
  $transaction: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("@/lib/auth/emails", () => ({ queuePasswordChangedEmail: vi.fn(), queueWelcomeEmail: vi.fn() }));
vi.mock("@/lib/auth/rate-limit-storage", () => ({ hitAuthCounter: vi.fn(), peekAuthCounter: vi.fn() }));

import {
  assertSignInNotLocked,
  beforeAccountCreate,
  beforeSessionCreate,
  beforeUserCreate,
  flagNicknameOnboardingIfNeeded,
  recordSignInOutcome,
  existingAccountCode,
  onPasswordReset,
  rejectExistingEmailSignUp,
} from "@/lib/auth/hooks";
import { hitAuthCounter, peekAuthCounter } from "@/lib/auth/rate-limit-storage";
import { recordAuthAudit } from "@/lib/auth/audit";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";

function ctx(path: string, cookie = "") {
  return { path, headers: new Headers(cookie ? { cookie } : {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findFirst.mockResolvedValue(null);
});

describe("beforeUserCreate for a passkey-first sign-up", () => {
  it("uses the placeholder name and keeps the language from the sign-up token", async () => {
    const result = await beforeUserCreate({ name: "x", email: "jan@b.pl", language: "pl" }, ctx("/passkey/verify-registration", "app-language=en"));
    expect(result.data).toMatchObject({ name: "jan", language: "pl", onboardingPending: true });
  });
});

describe("beforeUserCreate (placeholder name, avatar, onboarding)", () => {
  it("gives e-mail sign-ups a neutral placeholder name, the default avatar and onboardingPending", async () => {
    const result = await beforeUserCreate({ name: "ignored client value", email: "jan.kowalski+x@b.pl", image: "https://evil.example/x.png" }, ctx("/sign-up/email"));
    expect(result.data).toMatchObject({ name: "jan.kowalskix", image: "/default-avatar.jpg", email: "jan.kowalski+x@b.pl", onboardingPending: true });
  });

  it("falls back to a generic placeholder and caps its length", async () => {
    const odd = await beforeUserCreate({ email: "+++@b.pl" }, ctx("/sign-up/email"));
    expect(odd.data.name).toBe("user");
    const long = await beforeUserCreate({ email: `${"a".repeat(80)}@b.pl` }, ctx("/sign-up/email"));
    expect((long.data.name as string).length).toBe(30);
  });

  it("does not check nickname uniqueness at sign-up (that happens when the nickname is chosen)", async () => {
    await beforeUserCreate({ email: "a@b.pl" }, ctx("/sign-up/email"));
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("marks Google sign-ups as onboarding-pending and takes the language from the cookie", async () => {
    const result = await beforeUserCreate({ name: "Jan Kowalski", email: "g@gmail.com" }, ctx("/callback/google", "app-language=pl; other=1"));
    expect(result.data).toMatchObject({ onboardingPending: true, language: "pl", image: "/default-avatar.jpg" });
    expect(result.data.name).toBe("Jan Kowalski");
    const english = await beforeUserCreate({ name: "Jan", email: "g@gmail.com" }, ctx("/one-tap/callback"));
    expect(english.data.language).toBe("en");
  });

  it("records acceptance of the current Terms for every way of signing up (e-mail, Google, One Tap)", async () => {
    for (const path of ["/sign-up/email", "/callback/google", "/one-tap/callback"]) {
      const before = Date.now();
      const result = await beforeUserCreate({ email: "t@b.pl" }, ctx(path));
      expect(result.data.termsVersion, path).toBe(LEGAL_DOCUMENTS_VERSION);
      expect((result.data.termsAcceptedAt as Date).getTime(), path).toBeGreaterThanOrEqual(before);
    }
  });

  it("a client cannot pick the recorded Terms version or date", async () => {
    const result = await beforeUserCreate({ email: "t@b.pl", termsVersion: "1999-01-01", termsAcceptedAt: new Date(0) } as never, ctx("/sign-up/email"));
    expect(result.data.termsVersion).toBe(LEGAL_DOCUMENTS_VERSION);
    expect((result.data.termsAcceptedAt as Date).getTime()).toBeGreaterThan(0);
  });
});

describe("rejectExistingEmailSignUp (owner decision 2026-10-02)", () => {
  const run = (returnedId: string | undefined, email = "Owner@B.pl") =>
    rejectExistingEmailSignUp({ body: { email }, context: { returned: returnedId ? { token: null, user: { id: returnedId } } : undefined } });

  it("answers EMAIL_TAKEN when the stored user differs from the synthetic one in the response", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "real" });
    prisma.account.findMany.mockResolvedValueOnce([{ providerId: "credential" }]);
    await expect(run("synthetic")).rejects.toMatchObject({ statusCode: 422, body: { code: "EMAIL_TAKEN" } });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "owner@b.pl" }, select: { id: true } });
  });

  it("hints at Google when the account has no password", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "real" });
    prisma.account.findMany.mockResolvedValueOnce([{ providerId: "google" }]);
    await expect(run("synthetic")).rejects.toMatchObject({ body: { code: "EMAIL_TAKEN_GOOGLE" } });
  });

  it("stays quiet for a genuinely new account (stored id equals the returned one)", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "new" });
    await expect(run("new")).resolves.toBeUndefined();
    expect(prisma.account.findMany).not.toHaveBeenCalled();
  });

  it("does nothing without a returned user (another error already happened)", async () => {
    await expect(run(undefined)).resolves.toBeUndefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("beforeSessionCreate", () => {
  it("never opens a session for a soft-deleted or missing account", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ isDeleted: true });
    await expect(beforeSessionCreate({ userId: "u1" })).rejects.toMatchObject({ body: { code: "ACCOUNT_DELETED" } });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(beforeSessionCreate({ userId: "u2" })).rejects.toMatchObject({ body: { code: "ACCOUNT_DELETED" } });
    prisma.user.findUnique.mockResolvedValueOnce({ isDeleted: false });
    await expect(beforeSessionCreate({ userId: "u3" })).resolves.toBeUndefined();
  });
});

describe("beforeAccountCreate (pre-hijack guard)", () => {
  it("drops the unverified credential, passkeys and sessions when a verified provider is linked", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ emailVerified: false });
    await beforeAccountCreate({ userId: "u1", providerId: "google" });
    expect(prisma.account.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", providerId: "credential" } });
    // A passkey-first sign-up by somebody else must not survive the real owner's Google sign-in.
    expect(prisma.passkey.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.$transaction).toHaveBeenCalledWith(["delete-accounts", "delete-passkeys", "delete-sessions"]);
  });

  it("leaves a verified account (e.g. a legacy row) untouched", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ emailVerified: true });
    await beforeAccountCreate({ userId: "u1", providerId: "google" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("ignores the credential account itself", async () => {
    await beforeAccountCreate({ userId: "u1", providerId: "credential" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("onPasswordReset (passkey-first sign-up pre-hijack guard)", () => {
  it("drops passkeys of an account whose address was never verified: the reset link proves the mailbox", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ emailVerified: false });
    await onPasswordReset({ id: "u1", email: "a@b.pl" });
    expect(prisma.passkey.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("keeps the passkeys of a verified account", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ emailVerified: true });
    await onPasswordReset({ id: "u1", email: "a@b.pl" });
    expect(prisma.passkey.deleteMany).not.toHaveBeenCalled();
  });
});

describe("existingAccountCode", () => {
  it("tells a Google-only account apart from any other and ignores the given user id", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1" });
    prisma.account.findMany.mockResolvedValueOnce([{ providerId: "google" }]);
    expect(await existingAccountCode("A@B.pl")).toBe("EMAIL_TAKEN_GOOGLE");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "a@b.pl" }, select: { id: true } });
    prisma.account.findMany.mockResolvedValueOnce([]);
    expect(await existingAccountCode("a@b.pl")).toBe("EMAIL_TAKEN"); // e.g. a passkey-only account
    expect(await existingAccountCode("a@b.pl", "u1")).toBeNull();
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await existingAccountCode("free@b.pl")).toBeNull();
  });
});

describe("audit import is wired", () => {
  it("is mockable for hooks", () => {
    expect(recordAuthAudit).toBeDefined();
  });
});

describe("sign-in lockout counts only failures and is keyed per client (F-06)", () => {
  const request = (ip: string) => new Request("http://localhost/api/auth/sign-in/email", { headers: { "x-forwarded-for": ip } });
  const wrongPassword = { body: { code: "INVALID_EMAIL_OR_PASSWORD" } };

  it("counts a wrong password under the e-mail+client key and the e-mail-wide key", async () => {
    await recordSignInOutcome("User@Example.com", wrongPassword, { request: request("203.0.113.5") });
    expect(hitAuthCounter).toHaveBeenCalledTimes(2);
    const keys = vi.mocked(hitAuthCounter).mock.calls.map((call) => call[0]);
    expect(keys.some((key) => /^signin-fail:[0-9a-f]{32}:[0-9a-f]{32}$/.test(key))).toBe(true);
    expect(keys.some((key) => /^signin-fail:[0-9a-f]{32}$/.test(key))).toBe(true);
  });

  it("does not count successful sign-ins, unverified e-mails or other errors", async () => {
    await recordSignInOutcome("a@b.pl", { user: { id: "u1" } }, { request: request("203.0.113.5") });
    await recordSignInOutcome("a@b.pl", { body: { code: "EMAIL_NOT_VERIFIED" } }, { request: request("203.0.113.5") });
    await recordSignInOutcome("a@b.pl", undefined, { request: request("203.0.113.5") });
    expect(hitAuthCounter).not.toHaveBeenCalled();
  });

  it("locks out a client after 10 failures for that e-mail", async () => {
    vi.mocked(peekAuthCounter).mockResolvedValueOnce(10).mockResolvedValueOnce(10);
    await expect(assertSignInNotLocked("a@b.pl", { request: request("203.0.113.5") })).rejects.toMatchObject({
      body: { code: "TOO_MANY_ATTEMPTS" },
    });
  });

  it("does not lock out the owner when only another client failed (different per-IP key)", async () => {
    vi.mocked(peekAuthCounter).mockImplementation(async (key: string) => (/:[0-9a-f]{32}:[0-9a-f]{32}$/.test(key) ? 0 : 12));
    await expect(assertSignInNotLocked("a@b.pl", { request: request("198.51.100.9") })).resolves.toBeUndefined();
  });

  it("locks everyone out only past the e-mail-wide ceiling", async () => {
    vi.mocked(peekAuthCounter).mockImplementation(async (key: string) => (/:[0-9a-f]{32}:[0-9a-f]{32}$/.test(key) ? 0 : 100));
    await expect(assertSignInNotLocked("a@b.pl", { request: request("198.51.100.9") })).rejects.toMatchObject({
      body: { code: "TOO_MANY_ATTEMPTS" },
    });
  });
});

describe("flagNicknameOnboardingIfNeeded (F-09: Clerk-era names)", () => {
  const user = (over: Record<string, unknown> = {}) => ({
    name: "Jan Kowalski",
    onboardingPending: false,
    isDeleted: false,
    createdAt: new Date("2025-01-01"),
    ...over,
  });

  it("asks for a nickname when the stored name is missing", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user({ name: null }));
    await flagNicknameOnboardingIfNeeded("u1");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { onboardingPending: true } });
  });

  it("asks for a nickname when the name breaks the nickname rules", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user({ name: "ab" }));
    await flagNicknameOnboardingIfNeeded("u1");
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("asks the newer of two accounts sharing a name, but not the older one", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user());
    prisma.user.findFirst.mockResolvedValueOnce({ id: "older" });
    await flagNicknameOnboardingIfNeeded("u2");
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({
      isDeleted: false,
      id: { not: "u2" },
      createdAt: { lte: new Date("2025-01-01") },
    });
    prisma.user.update.mockClear();
    prisma.user.findUnique.mockResolvedValueOnce(user());
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await flagNicknameOnboardingIfNeeded("u1");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("leaves valid unique names, already-pending and deleted accounts alone", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user({ onboardingPending: true, name: null }));
    prisma.user.findUnique.mockResolvedValueOnce(user({ isDeleted: true, name: null }));
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await flagNicknameOnboardingIfNeeded("u1");
    await flagNicknameOnboardingIfNeeded("u1");
    await flagNicknameOnboardingIfNeeded("u1");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
