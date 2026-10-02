import { describe, expect, it, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), findUnique: vi.fn() },
  account: { deleteMany: vi.fn().mockReturnValue("delete-accounts") },
  session: { deleteMany: vi.fn().mockReturnValue("delete-sessions") },
  $transaction: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("@/lib/auth/emails", () => ({ queuePasswordChangedEmail: vi.fn(), queueWelcomeEmail: vi.fn() }));
vi.mock("@/lib/auth/rate-limit-storage", () => ({ hitAuthCounter: vi.fn() }));

import { beforeAccountCreate, beforeSessionCreate, beforeUserCreate } from "@/lib/auth/hooks";
import { recordAuthAudit } from "@/lib/auth/audit";

function ctx(path: string, cookie = "") {
  return { path, headers: new Headers(cookie ? { cookie } : {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findFirst.mockResolvedValue(null);
});

describe("beforeUserCreate (nickname, avatar, onboarding)", () => {
  it("accepts a valid nickname on e-mail sign-up and forces the default avatar", async () => {
    const result = await beforeUserCreate({ name: "  Nowy   Nick ", email: "a@b.pl", image: "https://evil.example/x.png" }, ctx("/sign-up/email"));
    expect(result.data).toMatchObject({ name: "Nowy Nick", image: "/default-avatar.jpg", email: "a@b.pl" });
    expect(result.data.onboardingPending).toBeUndefined();
  });

  it("rejects an invalid nickname", async () => {
    await expect(beforeUserCreate({ name: "ab", email: "a@b.pl" }, ctx("/sign-up/email"))).rejects.toMatchObject({
      body: { code: "INVALID_NICKNAME" },
    });
    await expect(beforeUserCreate({ name: "zły!nick", email: "a@b.pl" }, ctx("/sign-up/email"))).rejects.toMatchObject({
      body: { code: "INVALID_NICKNAME" },
    });
  });

  it("rejects a nickname another non-deleted user already uses (case-insensitive)", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: "other" });
    await expect(beforeUserCreate({ name: "Taken", email: "a@b.pl" }, ctx("/sign-up/email"))).rejects.toMatchObject({
      body: { code: "NICKNAME_TAKEN" },
    });
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({
      isDeleted: false,
      name: { equals: "Taken", mode: "insensitive" },
    });
  });

  it("marks Google sign-ups as onboarding-pending and takes the language from the cookie", async () => {
    const result = await beforeUserCreate({ name: "Jan Kowalski", email: "g@gmail.com" }, ctx("/callback/google", "app-language=pl; other=1"));
    expect(result.data).toMatchObject({ onboardingPending: true, language: "pl", image: "/default-avatar.jpg" });
    expect(result.data.name).toBe("Jan Kowalski");
    const english = await beforeUserCreate({ name: "Jan", email: "g@gmail.com" }, ctx("/one-tap/callback"));
    expect(english.data.language).toBe("en");
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
  it("drops the unverified credential and sessions when a verified provider is linked", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ emailVerified: false });
    await beforeAccountCreate({ userId: "u1", providerId: "google" });
    expect(prisma.account.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", providerId: "credential" } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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

describe("audit import is wired", () => {
  it("is mockable for hooks", () => {
    expect(recordAuthAudit).toBeDefined();
  });
});
