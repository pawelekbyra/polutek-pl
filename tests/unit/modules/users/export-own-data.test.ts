import { describe, expect, it, vi } from "vitest";
import { ExportOwnDataUseCase } from "@/lib/modules/users/application/export-own-data.use-case";

function fakeCtx() {
  const find = (rows: unknown[]) => ({ findMany: vi.fn(async () => rows) });
  const prisma = {
    user: { findUnique: vi.fn(async () => ({ id: "u1", email: "a@example.com" })) },
    comment: find([{ id: "c1", text: "hi" }]),
    videoLike: find([{ videoId: "v1", createdAt: new Date(0) }]),
    videoDislike: find([{ videoId: "v2", createdAt: new Date(0) }]),
    commentReaction: find([]),
    subscription: find([]),
    emailPreference: find([]),
    payment: find([{ id: "p1", amountMinor: 500, currency: "PLN", status: "SUCCEEDED" }]),
    videoFavorite: find([{ videoId: "v3", createdAt: new Date(0) }]),
    videoProgress: find([{ videoId: "v1", positionSeconds: 120, durationSeconds: 600, updatedAt: new Date(0) }]),
    creator: { findMany: vi.fn(async () => [{ id: "ch1", slug: "owned", name: "Own channel", publicContactEmail: "public@example.com" }]) },
    channelMember: { findMany: vi.fn(async () => [{ channelId: "ch2", role: "EDITOR", acceptedAt: new Date(0), createdAt: new Date(0) }]) },
    notificationPreference: { findUnique: vi.fn(async () => ({ patronEnabled: false, commentEnabled: true, systemEnabled: true, newVideoInApp: false, newVideoEmail: false, moderationEnabled: true, updatedAt: new Date(0) })) },
    patronGrant: { findMany: vi.fn(async () => [{ source: "STRIPE_TIP", createdAt: new Date(0), revokedAt: null }]) },
  };
  return { prisma, ctx: { prisma, now: () => new Date("2026-10-05T10:00:00Z") } as never };
}

describe("ExportOwnDataUseCase", () => {
  it("returns only the person's own rows and merges likes and dislikes", async () => {
    const { ctx, prisma } = fakeCtx();
    const data = await ExportOwnDataUseCase.execute(ctx, "u1");

    expect(data.schemaVersion).toBe(1);
    expect(data.exportedAt).toBe("2026-10-05T10:00:00.000Z");
    expect(data.account).toMatchObject({ id: "u1" });
    expect(data.comments).toHaveLength(1);
    expect(data.videoReactions.map((r) => r.type).sort()).toEqual(["dislike", "like"]);
    expect(data.payments).toHaveLength(1);
    expect(data.videoProgress).toEqual([
      { videoId: "v1", positionSeconds: 120, durationSeconds: 600, updatedAt: new Date(0) },
    ]);
    expect(data.videoFavorites).toEqual([{ videoId: "v3", createdAt: new Date(0) }]);
    expect(data.creatorProfiles).toEqual([{ id: "ch1", slug: "owned", name: "Own channel", publicContactEmail: "public@example.com" }]);
    expect(data.channelMemberships).toHaveLength(1);
    expect(data.notificationPreferences).toMatchObject({ patronEnabled: false, newVideoInApp: false });
    expect(data.patronGrants).toEqual([{ source: "STRIPE_TIP", createdAt: new Date(0), revokedAt: null }]);
    // every query is scoped to this account
    expect(prisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { authorId: "u1" } }));
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.emailPreference.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.videoProgress.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.videoFavorite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.creator.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.channelMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.notificationPreference.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.patronGrant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
  });

  it("never selects secrets, tokens or IP addresses", async () => {
    const { ctx, prisma } = fakeCtx();
    await ExportOwnDataUseCase.execute(ctx, "u1");
    const selects = JSON.stringify([
      prisma.user.findUnique.mock.calls,
      prisma.comment.findMany.mock.calls,
      prisma.payment.findMany.mock.calls,
      prisma.creator.findMany.mock.calls,
      prisma.channelMember.findMany.mock.calls,
      prisma.notificationPreference.findUnique.mock.calls,
      prisma.patronGrant.findMany.mock.calls,
    ]);
    expect(selects).not.toMatch(/password|token|secret|ipAddress|userAgent|stripeCustomerId|stripeIntentId|statusReason|statusChangedById|statusDecisionId|grantedById|revokeReason|paymentId/i);
  });

  it("keeps the notification-preferences category explicit when no preference row exists", async () => {
    const { ctx, prisma } = fakeCtx();
    prisma.notificationPreference.findUnique.mockResolvedValue(null);

    const data = await ExportOwnDataUseCase.execute(ctx, "u1");

    expect(Object.hasOwn(data, "notificationPreferences")).toBe(true);
    expect(data.notificationPreferences).toBeNull();
  });
});
