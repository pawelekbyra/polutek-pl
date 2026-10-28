import { beforeEach, describe, expect, it, vi } from "vitest";

const { creatorFindUnique, videoFindMany, videoAggregate, appSettingFindUnique, userFindFirst } = vi.hoisted(() => ({
  creatorFindUnique: vi.fn(),
  videoFindMany: vi.fn(),
  videoAggregate: vi.fn(),
  appSettingFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appSetting: { findUnique: appSettingFindUnique },
    creator: { findUnique: creatorFindUnique, findFirst: vi.fn() },
    channelHandleHistory: { findFirst: vi.fn() },
    video: { findMany: videoFindMany, aggregate: videoAggregate },
    user: { findFirst: userFindFirst },
  },
}));

import { CreatorContentService } from "@/lib/modules/channel/infrastructure/creator-content.service";

const creatorRow = {
  id: "creator-1",
  userId: "owner",
  slug: "polutek",
  handle: null,
  name: "Pawel Perfect",
  bio: "Opis",
  subscribersCount: 5,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  status: "ACTIVE",
  deletedAt: null,
  user: { imageUrl: "/api/avatars/owner", email: "owner@example.com" },
};

function row(id: string) {
  return {
    id,
    creatorId: "creator-1",
    title: `Film ${id}`,
    slug: id,
    tier: "PUBLIC",
    status: "PUBLISHED",
    views: 1,
    likesCount: 0,
    dislikesCount: 0,
    isMainFeatured: false,
    sidebarOrder: 0,
    publishedAt: new Date("2026-01-01"),
    premiereAt: null,
  };
}

describe("CreatorContentService channel header and video pages (W04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appSettingFindUnique.mockResolvedValue({ key: "main_channel_id", value: "creator-1" });
    userFindFirst.mockResolvedValue(null);
    creatorFindUnique.mockResolvedValue(creatorRow);
    videoAggregate.mockResolvedValue({ _count: { _all: 57 }, _sum: { views: 1234 } });
    videoFindMany.mockResolvedValue([row("a"), row("b")]);
  });

  it("builds the header without loading any video: the count and the views are aggregates", async () => {
    const header = await CreatorContentService.getCreatorHeaderBySlug("polutek");

    expect(header?.videoCount).toBe(57);
    expect(header?.about?.totalViews).toBe(1234);
    expect(header?.imageUrl).toBe("/api/avatars/owner");
    expect(header).not.toHaveProperty("videos");
    expect(videoFindMany).not.toHaveBeenCalled();
    // Same visibility rules as the video list: published, due, not removed by moderation.
    const where = videoAggregate.mock.calls[0]![0].where;
    expect(where).toMatchObject({ creatorId: "creator-1", status: "PUBLISHED", moderationStatus: { not: "REMOVED" } });
  });

  it("does not serve a channel that is not publicly visible", async () => {
    creatorFindUnique.mockResolvedValue({ ...creatorRow, status: "SUSPENDED" });
    expect(await CreatorContentService.getCreatorHeaderBySlug("polutek")).toBeNull();
    expect(await CreatorContentService.getCreatorHeaderById("creator-1")).toBeNull();
    expect(videoAggregate).not.toHaveBeenCalled();
  });

  it("reads one page of list columns in the page order, ties closed by id", async () => {
    const header = (await CreatorContentService.getCreatorHeaderBySlug("polutek"))!;
    const videos = await CreatorContentService.getChannelVideosPage(header, { offset: 24, limit: 24 });

    const args = videoFindMany.mock.calls[0]![0];
    expect(args.skip).toBe(24);
    expect(args.take).toBe(24);
    expect(args.omit).toMatchObject({ description: true, descriptionEn: true, searchText: true, chapters: true });
    expect(args.orderBy.at(-1)).toEqual({ id: "asc" });
    expect(args.where).toMatchObject({ creatorId: "creator-1", status: "PUBLISHED", moderationStatus: { not: "REMOVED" } });
    expect(videos.map((v) => v.id)).toEqual(["a", "b"]);
    // No description key at all: "not loaded" (the open video's one is fetched on its own).
    expect(videos[0]).not.toHaveProperty("description");
    expect(videos[0].creator).toMatchObject({ id: "creator-1", name: "Pawel Perfect", imageUrl: "/api/avatars/owner", subscribersCount: 5 });
  });

  it("caps the page size", async () => {
    const header = (await CreatorContentService.getCreatorHeaderBySlug("polutek"))!;
    await CreatorContentService.getChannelVideosPage(header, { limit: 5000 });
    expect(videoFindMany.mock.calls[0]![0].take).toBe(60);
  });
});
