import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock("@/lib/modules/access", () => ({ checkVideoAccess: mocks.checkVideoAccess }));
vi.mock("@/lib/modules/channel", () => ({
  publiclyVisibleChannelWhere: () => ({ status: { in: ["ACTIVE", "LIMITED"] }, deletedAt: null }),
}));
vi.mock("@/lib/modules/media", () => ({
  resolvePublicThumbnailSrc: (video: { id: string }) => `/api/videos/${video.id}/thumbnail`,
}));

import {
  getVideoProgressSeconds,
  listContinueWatching,
  saveVideoProgress,
} from "@/lib/modules/watch-progress";

const NOW = new Date("2026-10-14T12:00:00Z");

function makeCtx(overrides: { duration?: string | null; actor?: unknown } = {}) {
  const prisma = {
    video: {
      findUnique: vi.fn(async () => ({ duration: overrides.duration === undefined ? "10:00" : overrides.duration })),
    },
    videoProgress: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
    },
  };
  const ctx = {
    prisma,
    now: () => NOW,
    actor: overrides.actor ?? { type: "user", userId: "u1" },
  };
  return { ctx: ctx as never, prisma };
}

describe("saveVideoProgress", () => {
  beforeEach(() => {
    mocks.checkVideoAccess.mockReset();
    mocks.checkVideoAccess.mockResolvedValue({ ok: true, data: { hasAccess: true, videoId: "vid-1" } });
  });

  it("upserts a position between 5 s and 95 % for the signed-in viewer", async () => {
    const { ctx, prisma } = makeCtx();
    const result = await saveVideoProgress({ videoId: "vid-1", positionSeconds: 120, durationSeconds: 600 }, ctx);

    expect(result).toEqual({ ok: true, data: { status: "saved" } });
    expect(prisma.videoProgress.upsert).toHaveBeenCalledWith({
      where: { userId_videoId: { userId: "u1", videoId: "vid-1" } },
      create: { userId: "u1", videoId: "vid-1", positionSeconds: 120, durationSeconds: 600 },
      update: { positionSeconds: 120, durationSeconds: 600 },
    });
  });

  it("writes nothing below 5 seconds", async () => {
    const { ctx, prisma } = makeCtx();
    const result = await saveVideoProgress({ videoId: "vid-1", positionSeconds: 4, durationSeconds: 600 }, ctx);

    expect(result).toEqual({ ok: true, data: { status: "ignored" } });
    expect(prisma.videoProgress.upsert).not.toHaveBeenCalled();
    expect(prisma.videoProgress.deleteMany).not.toHaveBeenCalled();
  });

  it("saves exactly at 5 seconds", async () => {
    const { ctx, prisma } = makeCtx();
    await saveVideoProgress({ videoId: "vid-1", positionSeconds: 5, durationSeconds: 600 }, ctx);
    expect(prisma.videoProgress.upsert).toHaveBeenCalledTimes(1);
  });

  it("removes the row past 95 % (the video's own length decides, not the client's)", async () => {
    const { ctx, prisma } = makeCtx({ duration: "10:00" });
    // The client claims a 2 h video; the stored length (600 s) wins: 580 s is past 95 %.
    const result = await saveVideoProgress({ videoId: "vid-1", positionSeconds: 580, durationSeconds: 7200 }, ctx);

    expect(result).toEqual({ ok: true, data: { status: "cleared" } });
    expect(prisma.videoProgress.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", videoId: "vid-1" } });
    expect(prisma.videoProgress.upsert).not.toHaveBeenCalled();
  });

  it("uses the reported length when the video has none stored", async () => {
    const { ctx, prisma } = makeCtx({ duration: null });
    await saveVideoProgress({ videoId: "vid-1", positionSeconds: 290, durationSeconds: 300 }, ctx);
    expect(prisma.videoProgress.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("refuses a guest", async () => {
    const { ctx, prisma } = makeCtx({ actor: { type: "guest" } });
    const result = await saveVideoProgress({ videoId: "vid-1", positionSeconds: 100 }, ctx);

    expect(result.ok).toBe(false);
    expect(mocks.checkVideoAccess).not.toHaveBeenCalled();
    expect(prisma.videoProgress.upsert).not.toHaveBeenCalled();
  });

  it("answers not found (and writes nothing) when the viewer may not watch the video", async () => {
    mocks.checkVideoAccess.mockResolvedValue({ ok: true, data: { hasAccess: false, reason: "LOGIN_REQUIRED" } });
    const { ctx, prisma } = makeCtx();
    const result = await saveVideoProgress({ videoId: "vid-1", positionSeconds: 100 }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.statusCode).toBe(404);
    expect(prisma.videoProgress.upsert).not.toHaveBeenCalled();
  });

  it("does not store progress of an upcoming premiere", async () => {
    mocks.checkVideoAccess.mockResolvedValue({
      ok: true,
      data: { hasAccess: true, videoId: "vid-1", premiereAt: "2026-12-01T00:00:00.000Z" },
    });
    const { ctx, prisma } = makeCtx();
    const result = await saveVideoProgress({ videoId: "vid-1", positionSeconds: 100 }, ctx);

    expect(result.ok).toBe(false);
    expect(prisma.videoProgress.upsert).not.toHaveBeenCalled();
  });

  it("stores under the id the access check resolved (a slug cannot write another row)", async () => {
    mocks.checkVideoAccess.mockResolvedValue({ ok: true, data: { hasAccess: true, videoId: "real-id" } });
    const { ctx, prisma } = makeCtx();
    await saveVideoProgress({ videoId: "some-slug", positionSeconds: 100, durationSeconds: 600 }, ctx);
    expect(prisma.videoProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_videoId: { userId: "u1", videoId: "real-id" } } }),
    );
  });
});

describe("getVideoProgressSeconds", () => {
  it("returns the position of a resumable row", async () => {
    const { ctx, prisma } = makeCtx();
    prisma.videoProgress.findUnique.mockResolvedValue({
      positionSeconds: 200,
      durationSeconds: 600,
      video: { duration: "10:00" },
    });
    expect(await getVideoProgressSeconds("u1", "vid-1", ctx)).toBe(200);
    expect(prisma.videoProgress.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_videoId: { userId: "u1", videoId: "vid-1" } } }),
    );
  });

  it("returns null for no row and for a row past 95 %", async () => {
    const { ctx, prisma } = makeCtx();
    prisma.videoProgress.findUnique.mockResolvedValueOnce(null);
    expect(await getVideoProgressSeconds("u1", "vid-1", ctx)).toBeNull();
    prisma.videoProgress.findUnique.mockResolvedValueOnce({
      positionSeconds: 590,
      durationSeconds: 600,
      video: { duration: "10:00" },
    });
    expect(await getVideoProgressSeconds("u1", "vid-1", ctx)).toBeNull();
  });
});

describe("listContinueWatching", () => {
  const row = (id: string, over: Record<string, unknown> = {}, videoOver: Record<string, unknown> = {}) => ({
    positionSeconds: 100,
    durationSeconds: 600,
    updatedAt: new Date(`2026-10-1${id}T10:00:00Z`),
    video: {
      id: `vid-${id}`,
      slug: `film-${id}`,
      title: `Film ${id}`,
      titleEn: null,
      status: "PUBLISHED",
      tier: "PUBLIC",
      moderationStatus: "VISIBLE",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      premiereAt: null,
      duration: "10:00",
      thumbnailUrl: "thumb",
      thumbnailPublicUrl: null,
      creator: { name: "Kanał", status: "ACTIVE", deletedAt: null },
      ...videoOver,
    },
    ...over,
  });

  it("asks only for the viewer's own rows of link-reachable, visible videos", async () => {
    const { ctx, prisma } = makeCtx();
    await listContinueWatching("u1", ctx);
    const args = prisma.videoProgress.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).toMatchObject({
      userId: "u1",
      video: { status: { in: ["PUBLISHED", "UNLISTED"] }, moderationStatus: { not: "REMOVED" } },
    });
  });

  it("returns at most 6, newest first, with progress and a safe thumbnail", async () => {
    const { ctx, prisma } = makeCtx();
    prisma.videoProgress.findMany.mockResolvedValue(
      ["1", "2", "3", "4", "5", "6", "7", "8"].map((n) => row(n)) as never,
    );
    const items = await listContinueWatching("u1", ctx);

    expect(items).toHaveLength(6);
    expect(items[0].videoId).toBe("vid-8");
    expect(items[0]).toMatchObject({
      slug: "film-8",
      thumbnailUrl: "/api/videos/vid-8/thumbnail",
      positionSeconds: 100,
      durationSeconds: 600,
    });
    expect(items[0].fraction).toBeCloseTo(100 / 600);
  });

  it("keeps an UNLISTED video the viewer opened by link (the shelf is their own)", async () => {
    const { ctx, prisma } = makeCtx();
    prisma.videoProgress.findMany.mockResolvedValue([row("1", {}, { status: "UNLISTED" })] as never);
    const items = await listContinueWatching("u1", ctx);
    expect(items.map((i) => i.videoId)).toEqual(["vid-1"]);
  });

  it("leaves out drafts, removed, paid, upcoming premieres, hidden channels and finished videos", async () => {
    const { ctx, prisma } = makeCtx();
    prisma.videoProgress.findMany.mockResolvedValue([
      row("1", {}, { status: "DRAFT" }),
      row("2", {}, { moderationStatus: "REMOVED" }),
      row("3", {}, { tier: "PAID" }),
      row("4", {}, { premiereAt: new Date("2026-12-01T00:00:00Z") }),
      row("5", {}, { creator: { name: "K", status: "SUSPENDED", deletedAt: null } }),
      row("6", { positionSeconds: 590 }),
      row("7", { positionSeconds: 3 }),
      row("8", {}, { creator: null }),
      row("9"),
    ] as never);
    const items = await listContinueWatching("u1", ctx);
    expect(items.map((i) => i.videoId)).toEqual(["vid-9"]);
  });
});
