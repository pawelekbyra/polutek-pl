/** AUTH-10/11 (F-11): an account that has not picked a nickname cannot write under its placeholder name, and placeholders reserve nothing. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: { user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/audit", () => ({ recordAuthAudit: vi.fn() }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEventSafe: vi.fn() }));

import { resolveDbBackedActor } from "@/lib/api/auth";
import { CommentPolicy } from "@/lib/modules/comments/domain/comment.policy";
import { createVideoComment } from "@/lib/modules/comments/application/create-video-comment.use-case";
import { CheckNicknameAvailabilityUseCase } from "@/lib/modules/users/application/check-nickname-availability.use-case";
import { completeOnboarding } from "@/lib/modules/users/application/update-user-profile.use-case";

const access = { hasAccess: true } as const;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAILS;
});

describe("server-side onboarding gate", () => {
  it("marks the actor of an account still in onboarding", async () => {
    h.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", isDeleted: false, email: "a@b.pl", emailVerified: true, onboardingPending: true });
    expect(await resolveDbBackedActor("u1")).toEqual({ type: "user", userId: "u1", onboardingPending: true });
    h.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", isDeleted: false, email: "a@b.pl", emailVerified: true, onboardingPending: false });
    expect(await resolveDbBackedActor("u1")).toEqual({ type: "user", userId: "u1" });
  });

  it("blocks comments, reactions and edits until a nickname is chosen", () => {
    const pending = { type: "user", userId: "u1", onboardingPending: true } as const;
    const done = { type: "user", userId: "u1" } as const;
    expect(CommentPolicy.canCreateComment(pending, access)).toBe(false);
    expect(CommentPolicy.canReactToVideo(pending, access)).toBe(false);
    expect(CommentPolicy.canReactToComment(pending, access)).toBe(false);
    expect(CommentPolicy.canUpdateComment(pending, "u1")).toBe(false);
    expect(CommentPolicy.canCreateComment(done, access)).toBe(true);
    expect(CommentPolicy.canUpdateComment(done, "u1")).toBe(true);
  });

  it("answers a comment attempt with ONBOARDING_REQUIRED before touching the video", async () => {
    const prisma = { video: { findUnique: vi.fn() } };
    const result = await createVideoComment(
      { videoId: "some-slug", text: "hello" },
      { actor: { type: "user", userId: "u1", onboardingPending: true }, prisma } as never,
    );
    expect(result).toMatchObject({ ok: false, error: { type: "FORBIDDEN", code: "ONBOARDING_REQUIRED" } });
    expect(prisma.video.findUnique).not.toHaveBeenCalled();
  });
});

describe("nicknames", () => {
  it("do not count placeholders of accounts in onboarding as taken", async () => {
    const prisma = { user: { findFirst: vi.fn().mockResolvedValue(null) } };
    await CheckNicknameAvailabilityUseCase.execute({ prisma } as never, "jan.kowalski");
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isDeleted: false, onboardingPending: false }) }),
    );
  });

  it("turn a lost race on the unique index into NICKNAME_TAKEN", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.pl", name: "a", language: "pl", isDeleted: false, onboardingPending: true }),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" })),
      },
    };
    await expect(completeOnboarding({ prisma } as never, { userId: "u1", nickname: "Kasia" })).rejects.toMatchObject({ code: "NICKNAME_TAKEN" });
  });
});
