import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/modules/channel", () => ({
  publiclyVisibleChannelWhere: () => ({ status: { in: ["ACTIVE", "LIMITED"] }, deletedAt: null }),
}));
vi.mock("@/lib/modules/media", () => ({
  resolvePublicThumbnailSrc: (video: { id: string }) => `/api/videos/${video.id}/thumbnail`,
}));

import { favoritableVideoWhere, isVideoFavorited, listFavoriteVideos, setVideoFavorite } from "@/lib/modules/favorites";

function makeCtx(over: { actor?: unknown; video?: unknown; existing?: unknown; rows?: unknown[] } = {}) {
  const prisma = {
    video: { findFirst: vi.fn(async () => (over.video === undefined ? { id: "vid-1" } : over.video)) },
    videoFavorite: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => over.existing ?? null),
      findMany: vi.fn(async () => over.rows ?? []),
    },
  };
  return { prisma, ctx: { prisma, now: () => new Date(0), actor: over.actor ?? { type: "user", userId: "u1" } } as never };
}

describe("setVideoFavorite", () => {
  it("saves a listed video for the signed-in viewer (idempotent upsert)", async () => {
    const { ctx, prisma } = makeCtx();
    expect(await setVideoFavorite({ videoId: "vid-1", favorite: true }, ctx)).toEqual({ ok: true, data: { favorited: true } });
    expect(prisma.videoFavorite.upsert).toHaveBeenCalledWith({
      where: { userId_videoId: { userId: "u1", videoId: "vid-1" } },
      create: { userId: "u1", videoId: "vid-1" },
      update: {},
    });
  });

  it("checks the video against the public lists only, so a locked premium video can be saved", async () => {
    const { ctx, prisma } = makeCtx();
    await setVideoFavorite({ videoId: "vid-1", favorite: true }, ctx);
    const where = (prisma.video.findFirst.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where).toEqual({ id: "vid-1", ...favoritableVideoWhere() });
    expect(JSON.stringify(where)).not.toContain("tier");
    expect(where).toMatchObject({ status: "PUBLISHED", moderationStatus: { not: "REMOVED" } });
  });

  it("answers 404 for a video that is not listed or does not exist and stores nothing", async () => {
    const { ctx, prisma } = makeCtx({ video: null });
    const result = await setVideoFavorite({ videoId: "hidden", favorite: true }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.statusCode).toBe(404);
    expect(prisma.videoFavorite.upsert).not.toHaveBeenCalled();
  });

  it("removes without any video check, scoped to the viewer (a hidden video can still be cleaned up)", async () => {
    const { ctx, prisma } = makeCtx({ video: null });
    expect(await setVideoFavorite({ videoId: "vid-1", favorite: false }, ctx)).toEqual({ ok: true, data: { favorited: false } });
    expect(prisma.video.findFirst).not.toHaveBeenCalled();
    expect(prisma.videoFavorite.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", videoId: "vid-1" } });
  });

  it("refuses a guest with 401", async () => {
    const { ctx, prisma } = makeCtx({ actor: { type: "guest" } });
    const result = await setVideoFavorite({ videoId: "vid-1", favorite: true }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.statusCode).toBe(401);
    expect(prisma.videoFavorite.upsert).not.toHaveBeenCalled();
  });
});

describe("isVideoFavorited / listFavoriteVideos", () => {
  it("reads only the own row of the viewer", async () => {
    const { ctx, prisma } = makeCtx({ existing: { id: "f1" } });
    expect(await isVideoFavorited("u1", "vid-1", ctx)).toBe(true);
    expect(prisma.videoFavorite.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_videoId: { userId: "u1", videoId: "vid-1" } } }),
    );
    expect(await isVideoFavorited("u1", "vid-2", makeCtx().ctx)).toBe(false);
  });

  it("lists still-listed favorites newest first with safe thumbnail addresses", async () => {
    const { ctx, prisma } = makeCtx({
      rows: [
        { video: { id: "vid-1", slug: "film-1", title: "Film", titleEn: null, status: "PUBLISHED", thumbnailUrl: "r2://secret", thumbnailPublicUrl: null, creator: { name: "Kanał" } } },
      ],
    });
    const items = await listFavoriteVideos("u1", ctx);
    expect(items).toEqual([
      { videoId: "vid-1", slug: "film-1", title: "Film", titleEn: null, thumbnailUrl: "/api/videos/vid-1/thumbnail", channelName: "Kanał" },
    ]);
    expect(prisma.videoFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", video: favoritableVideoWhere() }, orderBy: { createdAt: "desc" } }),
    );
  });
});
