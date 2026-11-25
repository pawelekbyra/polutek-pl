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
    broadcastEmailRecipient: { findMany: vi.fn(async () => [{ language: "pl", status: "DELIVERED", sentAt: new Date(0), deliveredAt: new Date(1000), openedAt: null, clickedAt: null, bouncedAt: null, complainedAt: null, createdAt: new Date(0), updatedAt: new Date(1000) }]) },
    emailEvent: { findMany: vi.fn(async () => [{ type: "delivered", status: "PROCESSED", processedAt: new Date(1000), createdAt: new Date(0), updatedAt: new Date(1000) }]) },
    payment: find([{ id: "p1", amountMinor: 500, currency: "PLN", status: "SUCCEEDED" }]),
    videoFavorite: find([{ videoId: "v3", createdAt: new Date(0) }]),
    videoView: { findMany: vi.fn(async () => [{ videoId: "v-view", createdAt: new Date(0) }]) },
    videoPlaybackSession: { findMany: vi.fn(async () => [{ videoId: "v-session", sourceKind: "HLS", provider: "R2", accessTier: "PUBLIC", startedAt: new Date(0), firstPlayAt: new Date(1000), lastHeartbeatAt: new Date(2000), totalWatchMs: 30_000, maxProgressMs: 15_000, durationMs: 120_000, countedAsView: true, isAdminPreview: false, errorCode: null, createdAt: new Date(0), updatedAt: new Date(2000) }]) },
    videoPlaybackEvent: { findMany: vi.fn(async () => [{ videoId: "v-event", type: "PLAY", positionMs: 1500, durationMs: 120_000, bufferedMs: 4000, volume: 0.5, muted: false, fullscreen: true, errorCode: null, provider: "R2", sourceKind: "HLS", createdAt: new Date(1000) }]) },
    videoProgress: find([{ videoId: "v1", positionSeconds: 120, durationSeconds: 600, updatedAt: new Date(0) }]),
    creator: { findMany: vi.fn(async () => [{ id: "ch1", slug: "owned", name: "Own channel", publicContactEmail: "public@example.com" }]) },
    channelMember: { findMany: vi.fn(async () => [{ channelId: "ch2", role: "EDITOR", acceptedAt: new Date(0), createdAt: new Date(0) }]) },
    notificationPreference: { findUnique: vi.fn(async () => ({ patronEnabled: false, commentEnabled: true, systemEnabled: true, newVideoInApp: false, newVideoEmail: false, moderationEnabled: true, updatedAt: new Date(0) })) },
    notification: { findMany: vi.fn(async () => [{ kind: "NEW_VIDEO", read: true, createdAt: new Date(0) }]) },
    patronGrant: { findMany: vi.fn(async () => [{ source: "STRIPE_TIP", createdAt: new Date(0), revokedAt: null }]) },
    appSetting: { findUnique: vi.fn(async () => ({ value: null as string | null })) },
    userAvatar: { findUnique: vi.fn(async () => ({ mime: "image/png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) })) },
    channelBanner: { findMany: vi.fn(async () => [{ channelId: "ch1", mime: "image/webp", data: Buffer.from("RIFFdataWEBP") }]) },
  };
  return { prisma, ctx: { prisma, now: () => new Date("2026-10-05T10:00:00Z") } as never };
}

describe("ExportOwnDataUseCase", () => {
  it("returns only the person's own rows and merges likes and dislikes", async () => {
    const { ctx, prisma } = fakeCtx();
    const data = await ExportOwnDataUseCase.execute(ctx, "u1");

    expect(data.schemaVersion).toBe(4);
    expect(data.exportedAt).toBe("2026-10-05T10:00:00.000Z");
    expect(data.account).toMatchObject({ id: "u1" });
    expect(data.comments).toHaveLength(1);
    expect(data.videoReactions.map((r) => r.type).sort()).toEqual(["dislike", "like"]);
    expect(data.payments).toHaveLength(1);
    expect(data.broadcastEmailRecipients).toHaveLength(1);
    expect(data.emailEvents).toEqual([{ type: "delivered", status: "PROCESSED", processedAt: new Date(1000), createdAt: new Date(0), updatedAt: new Date(1000) }]);
    expect(data.videoProgress).toEqual([
      { videoId: "v1", positionSeconds: 120, durationSeconds: 600, updatedAt: new Date(0) },
    ]);
    expect(data.videoFavorites).toEqual([{ videoId: "v3", createdAt: new Date(0) }]);
    expect(data.videoViews).toEqual([{ videoId: "v-view", createdAt: new Date(0) }]);
    expect(data.playbackSessions).toEqual([expect.objectContaining({ videoId: "v-session", totalWatchMs: 30_000 })]);
    expect(data.playbackEvents).toEqual([expect.objectContaining({ videoId: "v-event", type: "PLAY", positionMs: 1500 })]);
    expect(data.creatorProfiles).toEqual([{ id: "ch1", slug: "owned", name: "Own channel", publicContactEmail: "public@example.com" }]);
    expect(data.channelMemberships).toHaveLength(1);
    expect(data.notificationPreferences).toMatchObject({ patronEnabled: false, newVideoInApp: false });
    expect(data.notifications).toEqual([{ kind: "NEW_VIDEO", read: true, createdAt: new Date(0) }]);
    expect(data.patronGrants).toEqual([{ source: "STRIPE_TIP", createdAt: new Date(0), revokedAt: null }]);
    expect(data.patronPass).toBeNull();
    expect(data.mediaAttachments).toEqual([
      { type: "avatar", ownerId: "u1", mime: "image/png", dataBase64: "iVBORw==" },
      { type: "channel_banner", ownerId: "ch1", mime: "image/webp", dataBase64: "UklGRmRhdGFXRUJQ" },
    ]);
    // every query is scoped to this account
    expect(prisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { authorId: "u1" } }));
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.emailPreference.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.broadcastEmailRecipient.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1" },
      select: expect.not.objectContaining({ id: true, email: true, resendEmailId: true, broadcastEmailId: true, error: true, attemptCount: true }),
    }));
    expect(prisma.emailEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1" },
      select: expect.not.objectContaining({ id: true, email: true, payload: true, error: true, providerEventId: true, resendEmailId: true }),
    }));
    expect(prisma.videoProgress.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.videoFavorite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.videoView.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" }, select: { videoId: true, createdAt: true }, orderBy: { createdAt: "asc" },
    });
    expect(prisma.videoPlaybackSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1" },
      select: expect.not.objectContaining({ id: true, ipHash: true, userAgentHash: true, errorMessage: true }),
    }));
    expect(prisma.videoPlaybackEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1" },
      select: expect.not.objectContaining({ id: true, sessionId: true, metadata: true, errorMessage: true }),
    }));
    expect(prisma.creator.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.channelMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.notificationPreference.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { kind: true, read: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    expect(prisma.patronGrant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.userAvatar.findUnique).toHaveBeenCalledWith({ where: { userId: "u1" }, select: { mime: true, data: true } });
    expect(prisma.channelBanner.findMany).toHaveBeenCalledWith({
      where: { channelId: { in: ["ch1"] } },
      select: { channelId: true, mime: true, data: true },
      orderBy: { channelId: "asc" },
    });
  });

  it("never selects secrets, tokens or IP addresses", async () => {
    const { ctx, prisma } = fakeCtx();
    await ExportOwnDataUseCase.execute(ctx, "u1");
    const selects = JSON.stringify([
      prisma.user.findUnique.mock.calls,
      prisma.comment.findMany.mock.calls,
      prisma.emailPreference.findMany.mock.calls,
      prisma.broadcastEmailRecipient.findMany.mock.calls,
      prisma.emailEvent.findMany.mock.calls,
      prisma.payment.findMany.mock.calls,
      prisma.creator.findMany.mock.calls,
      prisma.channelMember.findMany.mock.calls,
      prisma.notificationPreference.findUnique.mock.calls,
      prisma.notification.findMany.mock.calls,
      prisma.videoView.findMany.mock.calls,
      prisma.videoPlaybackSession.findMany.mock.calls,
      prisma.videoPlaybackEvent.findMany.mock.calls,
      prisma.patronGrant.findMany.mock.calls,
      prisma.userAvatar.findUnique.mock.calls,
      prisma.channelBanner.findMany.mock.calls,
    ]);
    expect(selects).not.toMatch(/password|token|secret|ipAddress|userAgent|ipHash|userAgentHash|metadata|errorMessage|payload|providerEventId|resendEmailId|broadcastEmailId|stripeCustomerId|stripeIntentId|statusReason|statusChangedById|statusDecisionId|grantedById|revokeReason|paymentId/i);
  });

  it("keeps the notification-preferences category explicit when no preference row exists", async () => {
    const { ctx, prisma } = fakeCtx();
    prisma.notificationPreference.findUnique.mockResolvedValue(null);

    const data = await ExportOwnDataUseCase.execute(ctx, "u1");

    expect(Object.hasOwn(data, "notificationPreferences")).toBe(true);
    expect(data.notificationPreferences).toBeNull();
  });

  it("omits absent media and skips the banner query when the account owns no channel", async () => {
    const { ctx, prisma } = fakeCtx();
    prisma.creator.findMany.mockResolvedValue([]);
    prisma.userAvatar.findUnique.mockResolvedValue(null);

    const data = await ExportOwnDataUseCase.execute(ctx, "u1");

    expect(data.mediaAttachments).toEqual([]);
    expect(prisma.channelBanner.findMany).not.toHaveBeenCalled();
  });

  it("fails closed for stored media with unsupported MIME or beyond the existing size limit", async () => {
    const { ctx, prisma } = fakeCtx();
    prisma.userAvatar.findUnique.mockResolvedValue({ mime: "image/svg+xml", data: Buffer.from("<svg/>") });

    await expect(ExportOwnDataUseCase.execute(ctx, "u1")).rejects.toMatchObject({ code: "OWN_DATA_IMAGE_INVALID" });

    prisma.userAvatar.findUnique.mockResolvedValue({ mime: "image/png", data: Buffer.alloc(90_000) });
    await expect(ExportOwnDataUseCase.execute(ctx, "u1")).rejects.toMatchObject({ code: "OWN_DATA_IMAGE_INVALID" });
  });

  it("exports only portable patron-pass fields from the exact account AppSetting key", async () => {
    const { ctx, prisma } = fakeCtx();
    prisma.appSetting.findUnique.mockResolvedValue({ value: JSON.stringify({
      v: 3,
      provider: "STRIPE",
      ref: "internal-ref",
      productId: "ACCESS_30D",
      priceMinor: 1499,
      totalMinor: 1499,
      currency: "PLN",
      method: "card",
      requestId: "c84fc6d5-6ae6-4b75-85f5-46b01dedf2ec",
      paymentIds: ["payment-internal-id"],
      lifetime: false,
      lifetimePaymentId: null,
      grantedAt: "2026-11-01T12:00:00.000Z",
      expiresAt: "2026-12-01T12:00:00.000Z",
      consents: { termsVersion: "patron-2026-10-draft", waiverAt: "2026-11-01T12:00:00.000Z" },
    }) });

    const data = await ExportOwnDataUseCase.execute(ctx, "u1");

    expect(data.patronPass).toEqual({
      provider: "STRIPE",
      productId: "ACCESS_30D",
      priceMinor: 1499,
      totalMinor: 1499,
      currency: "PLN",
      method: "card",
      grantedAt: "2026-11-01T12:00:00.000Z",
      expiresAt: "2026-12-01T12:00:00.000Z",
      consents: { termsVersion: "patron-2026-10-draft", waiverAt: "2026-11-01T12:00:00.000Z" },
    });
    expect(prisma.appSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "xp.premium_pass:u1" },
      select: { value: true },
    });

    prisma.appSetting.findUnique.mockResolvedValue({ value: "not-json" });
    const invalid = await ExportOwnDataUseCase.execute(ctx, "u1");
    expect(invalid.patronPass).toBeNull();
  });
});
