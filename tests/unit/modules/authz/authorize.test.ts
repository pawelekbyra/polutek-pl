import { describe, expect, it, vi } from "vitest";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { assertAuthorized, authorize } from "@/lib/modules/authz";

/** Two channels with different owners, one video each: the shape of a cross-channel (BOLA) attack. */
function ctxFor(actor: Actor) {
  const creators = {
    "ch-a": { id: "ch-a", userId: "user-a", status: "ACTIVE", members: [] },
    "ch-b": { id: "ch-b", userId: "user-b", status: "ACTIVE", members: [] },
    // Owned by user-b, suspended; user-e is an EDITOR in it, user-m a MODERATOR.
    "ch-s": { id: "ch-s", userId: "user-b", status: "SUSPENDED", members: [] },
    "ch-t": { id: "ch-t", userId: "user-b", status: "ACTIVE", members: [{ userId: "user-e", role: "EDITOR" }] },
  } as const;
  const videos = {
    "vid-a": { creator: creators["ch-a"] },
    "vid-b": { creator: creators["ch-b"] },
  } as const;
  const prisma = {
    creator: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => creators[where.id as keyof typeof creators] ?? null) },
    video: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => videos[where.id as keyof typeof videos] ?? null) },
  };
  const ctx = createAppContext({ actor, prisma: prisma as never }) as AppContext;
  return { ctx, prisma };
}

describe("authorize()", () => {
  it("lets the owner of channel A act on their own video and channel", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-a" });
    expect(await authorize(ctx, "video.update", { videoId: "vid-a" })).toBeNull();
    expect(await authorize(ctx, "video.upload", { channelId: "ch-a" })).toBeNull();
  });

  it("denies the owner of channel A on channel B's video and channel (cross-channel attack)", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-a" });
    const onVideo = await authorize(ctx, "video.update", { videoId: "vid-b" });
    expect(onVideo?.statusCode).toBe(403);
    expect(onVideo?.code).toBe("FORBIDDEN");
    const onChannel = await authorize(ctx, "channel.delete", { channelId: "ch-b" });
    expect(onChannel?.statusCode).toBe(403);
  });

  it("answers 404 for a target that does not exist instead of guessing", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-a" });
    const denied = await authorize(ctx, "video.update", { videoId: "missing" });
    expect(denied?.statusCode).toBe(404);
  });

  it("answers 401 for a guest", async () => {
    const { ctx, prisma } = ctxFor({ type: "guest" });
    const denied = await authorize(ctx, "video.update", { videoId: "vid-a" });
    expect(denied?.statusCode).toBe(401);
    expect(prisma.video.findUnique).not.toHaveBeenCalled();
  });

  it("decides for staff and system without touching the database", async () => {
    for (const actor of [{ type: "admin", userId: "adm" } as const, { type: "system", reason: "worker" } as const]) {
      const { ctx, prisma } = ctxFor(actor);
      expect(await authorize(ctx, "video.delete", { videoId: "vid-b" })).toBeNull();
      expect(prisma.video.findUnique).not.toHaveBeenCalled();
      expect(prisma.creator.findUnique).not.toHaveBeenCalled();
    }
  });

  it("does not let staff change a payout account", async () => {
    const { ctx } = ctxFor({ type: "admin", userId: "adm" });
    const denied = await authorize(ctx, "payout.manage", { channelId: "ch-a" });
    expect(denied?.statusCode).toBe(403);
  });

  it("uses a supplied channel without any query", async () => {
    const { ctx, prisma } = ctxFor({ type: "user", userId: "user-a" });
    expect(await authorize(ctx, "video.create", { channel: { id: "ch-a", ownerUserId: "user-a" } })).toBeNull();
    expect(prisma.creator.findUnique).not.toHaveBeenCalled();
  });

  it("channel.create needs no target", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-a" });
    expect(await authorize(ctx, "channel.create")).toBeNull();
  });

  it("platform actions are denied to a user without loading anything", async () => {
    const { ctx, prisma } = ctxFor({ type: "user", userId: "user-a" });
    const denied = await authorize(ctx, "platform.suspend_channel");
    expect(denied?.statusCode).toBe(403);
    expect(prisma.creator.findUnique).not.toHaveBeenCalled();
  });

  it("honours an explicit membership loaded from the database", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-e" });
    expect(await authorize(ctx, "video.update", { channelId: "ch-t" })).toBeNull();
    expect((await authorize(ctx, "channel.delete", { channelId: "ch-t" }))?.statusCode).toBe(403);
    expect((await authorize(ctx, "video.update", { channelId: "ch-a" }))?.statusCode).toBe(403);
  });

  it("freezes the owner of a suspended channel", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-b" });
    const denied = await authorize(ctx, "video.update", { channelId: "ch-s" });
    expect(denied?.code).toBe("CHANNEL_FROZEN");
    expect(await authorize(ctx, "video.update", { channelId: "ch-b" })).toBeNull();
  });

  it("asks the database only for the asking user's own membership", async () => {
    const { ctx, prisma } = ctxFor({ type: "user", userId: "user-e" });
    await authorize(ctx, "video.update", { channelId: "ch-t" });
    const select = (prisma.creator.findUnique.mock.calls[0][0] as { select: { members: { where: { userId: string } } } }).select;
    expect(select.members.where).toEqual({ userId: "user-e" });
  });

  it("assertAuthorized throws the same error", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-a" });
    await expect(assertAuthorized(ctx, "video.update", { videoId: "vid-b" })).rejects.toMatchObject({ statusCode: 403 });
  });
});
