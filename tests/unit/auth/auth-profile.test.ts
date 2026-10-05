import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/modules/audit", () => ({ recordAuditEventSafe: vi.fn() }));

import { completeOnboarding, updateAvatar, updateNickname, NicknameRejectedError } from "@/lib/modules/users/application/update-user-profile.use-case";
import { authErrorMessage } from "@/lib/auth/errors";
import { validateAvatarDataUrl, validateAvatarFile, AVATAR_MAX_BYTES } from "@/lib/auth/avatar";
import { authRateLimitStorage } from "@/lib/auth/rate-limit-storage";
import { createTx } from "@/lib/i18n/ui";

const user = { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() };
const userAvatar = { upsert: vi.fn(), deleteMany: vi.fn() };
const ctx = { prisma: { user, userAvatar } } as never;

// Smallest valid-looking payloads (signature bytes + padding) for each format.
const JPEG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]).toString("base64");
const PNG = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).toString("base64");
const WEBP = "data:image/webp;base64," + Buffer.from("RIFF1234WEBPVP8 ").toString("base64");

beforeEach(() => {
  vi.clearAllMocks();
  user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.pl", name: "Old", language: "pl", isDeleted: false, onboardingPending: false });
  user.findFirst.mockResolvedValue(null);
  user.update.mockImplementation(async ({ data }) => ({ email: "a@b.pl", language: "pl", ...data }));
});

describe("updateNickname", () => {
  it("normalizes and saves a free nickname", async () => {
    expect(await updateNickname(ctx, { userId: "u1", nickname: "  Nowy  Nick " })).toEqual({ name: "Nowy Nick" });
    expect(user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Nowy Nick" } });
  });

  it("excludes the user's own row from the taken check and reports a taken name as 409", async () => {
    user.findFirst.mockResolvedValueOnce({ id: "other" });
    await expect(updateNickname(ctx, { userId: "u1", nickname: "Zajęty" })).rejects.toMatchObject({ statusCode: 409, code: "NICKNAME_TAKEN" });
    expect(user.findFirst.mock.calls[0][0].where).toMatchObject({ id: { not: "u1" }, isDeleted: false });
  });

  it("rejects invalid nicknames and deleted accounts", async () => {
    await expect(updateNickname(ctx, { userId: "u1", nickname: "x" })).rejects.toBeInstanceOf(NicknameRejectedError);
    user.findUnique.mockResolvedValueOnce({ id: "u1", isDeleted: true });
    await expect(updateNickname(ctx, { userId: "u1", nickname: "Valid Nick" })).rejects.toMatchObject({ statusCode: 410 });
    expect(user.update).not.toHaveBeenCalled();
  });
});

describe("updateAvatar", () => {
  it("stores a validated image in its own table, points imageUrl at the avatar route and restores the default on null", async () => {
    const result = await updateAvatar(ctx, { userId: "u1", dataUrl: JPEG });
    expect(result.imageUrl).toMatch(/^\/api\/avatars\/u1\?v=\d+$/);
    expect(userAvatar.upsert).toHaveBeenCalledTimes(1);
    const saved = userAvatar.upsert.mock.calls[0][0];
    expect(saved.where).toEqual({ userId: "u1" });
    expect(saved.create.mime).toBe("image/jpeg");
    expect(saved.create.data).toBeInstanceOf(Uint8Array);
    expect(user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { imageUrl: result.imageUrl } });

    expect(await updateAvatar(ctx, { userId: "u1", dataUrl: null })).toEqual({ imageUrl: "/default-avatar.jpg" });
    expect(userAvatar.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("rejects anything that is not a small, real image data URL", async () => {
    await expect(updateAvatar(ctx, { userId: "u1", dataUrl: "https://evil.example/pixel.png" })).rejects.toMatchObject({ code: "INVALID_AVATAR" });
    await expect(updateAvatar(ctx, { userId: "u1", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" })).rejects.toMatchObject({ code: "INVALID_AVATAR" });
    await expect(updateAvatar(ctx, { userId: "u1", dataUrl: "data:image/png;base64," + Buffer.from("not a png at all").toString("base64") })).rejects.toMatchObject({ code: "INVALID_AVATAR" });
  });
});

describe("avatar validation", () => {
  it("checks the signature for each allowed format", () => {
    expect(validateAvatarDataUrl(JPEG).ok).toBe(true);
    expect(validateAvatarDataUrl(PNG).ok).toBe(true);
    expect(validateAvatarDataUrl(WEBP).ok).toBe(true);
    expect(validateAvatarDataUrl(PNG.replace("png", "jpeg")).ok).toBe(false);
    expect(validateAvatarDataUrl(123).ok).toBe(false);
    expect(validateAvatarDataUrl("data:image/jpeg;base64," + "A".repeat(130_000)).ok).toBe(false);
  });

  it("checks picked files by type and size", () => {
    expect(validateAvatarFile({ type: "image/png", size: 10 })).toBeNull();
    expect(validateAvatarFile({ type: "image/gif", size: 10 })).toBe("type");
    expect(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES + 1 })).toBe("size");
  });
});

describe("completeOnboarding (first Google sign-in)", () => {
  it("sets the nickname once, clears the flag and returns the user for the welcome mail", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", email: "g@gmail.com", isDeleted: false, onboardingPending: true });
    const result = await completeOnboarding(ctx, { userId: "u1", nickname: "Gracz", avatarDataUrl: PNG });
    expect(userAvatar.upsert).toHaveBeenCalledTimes(1);
    expect(user.update.mock.calls[0][0].data).toMatchObject({ name: "Gracz", onboardingPending: false, imageUrl: expect.stringMatching(/^\/api\/avatars\/u1\?v=\d+$/) });
    expect(result.name).toBe("Gracz");
  });

  it("saves the language chosen in the dialog with the nickname, so the welcome e-mail uses it", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", email: "g@gmail.com", isDeleted: false, onboardingPending: true });
    await completeOnboarding(ctx, { userId: "u1", nickname: "Gracz", language: "en" });
    expect(user.update.mock.calls[0][0].data).toEqual({ name: "Gracz", onboardingPending: false, language: "en" });
  });

  it("refuses a second run and keeps the default avatar when none is sent", async () => {
    await expect(completeOnboarding(ctx, { userId: "u1", nickname: "Gracz" })).rejects.toMatchObject({ code: "ONBOARDING_DONE" });
    user.findUnique.mockResolvedValue({ id: "u1", email: "g@gmail.com", isDeleted: false, onboardingPending: true });
    await completeOnboarding(ctx, { userId: "u1", nickname: "Gracz" });
    expect(user.update.mock.calls[0][0].data).toEqual({ name: "Gracz", onboardingPending: false });
    expect(userAvatar.upsert).not.toHaveBeenCalled();
  });
});

describe("authErrorMessage", () => {
  it("localizes known codes and never echoes unknown server messages", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, createTx("pl"))).toBe("Nieprawidłowy e-mail lub hasło.");
    expect(authErrorMessage({ code: "PASSWORD_COMPROMISED" }, createTx("en"))).toContain("breaches");
    expect(authErrorMessage({ code: "SOMETHING_NEW", message: "stack trace with secrets" }, createTx("en"))).toBe("Something went wrong. Please try again.");
    expect(authErrorMessage({ status: 429 }, createTx("pl"))).toContain("Za dużo");
    expect(authErrorMessage(null, createTx("pl"))).toBe("Coś poszło nie tak. Spróbuj ponownie.");
  });
});

describe("authRateLimitStorage.consume", () => {
  // CI sets Redis REST variables; this test must use the in-memory store.
  beforeEach(() => {
    for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
      vi.stubEnv(name, "");
    }
  });

  it("allows up to max requests per window and then reports a retry delay", async () => {
    const key = `test-${Math.random()}`;
    const rule = { window: 60, max: 2 };
    expect(await authRateLimitStorage.consume(key, rule)).toEqual({ allowed: true, retryAfter: null });
    expect(await authRateLimitStorage.consume(key, rule)).toEqual({ allowed: true, retryAfter: null });
    const blocked = await authRateLimitStorage.consume(key, rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });
});
