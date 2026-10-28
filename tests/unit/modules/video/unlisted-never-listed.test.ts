import { describe, it, expect, vi, beforeEach } from "vitest";

// "Niepubliczny" (UNLISTED) is reachable by link but must never be listed: every public list query has to filter
// `status = PUBLISHED` (CLAUDE.md 4.4, "Widocznosc filmu"). One test per query builder.

const hoisted = vi.hoisted(() => ({
  videoFindMany: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
  videoFindFirst: vi.fn(async (..._args: unknown[]) => null as unknown),
  videoGroupBy: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    video: { findMany: hoisted.videoFindMany, findFirst: hoisted.videoFindFirst, groupBy: hoisted.videoGroupBy },
    user: { findFirst: vi.fn(async () => null) },
    creator: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null) },
    channelHandleHistory: { findFirst: vi.fn(async () => null) },
  },
}));

vi.mock("@/lib/modules/channel", async () => {
  const policy = await import("@/lib/modules/channel/domain/channel.policy");
  return {
    MainChannelService: {
      getOptional: vi.fn(async () => ({ id: "main-channel" })),
      getRequired: vi.fn(async () => ({ id: "main-channel" })),
    },
    MainChannelPolicy: policy.MainChannelPolicy,
    publiclyVisibleChannelWhere: () => ({ status: { in: ["ACTIVE", "LIMITED"] }, deletedAt: null }),
    resolveChannelAvatarUrl: () => null,
    resolveMainChannelId: vi.fn(async () => "main-channel"),
    isMainChannelId: vi.fn(async () => true),
  };
});

import { VideoContentService, buildPublicVideoWhere } from "@/lib/modules/video/infrastructure/video-content.service";
import { VideoSearchService } from "@/lib/modules/video/application/video-search.service";
import { VideoRepository } from "@/lib/modules/video/infrastructure/video.repository";
import { VideoPolicy } from "@/lib/modules/video/domain/video.policy";
import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";
import { isVideoPubliclyVisible } from "@/lib/modules/video/domain/public-visibility";
import { isListedStatus, isLinkAccessibleStatus, shouldNoIndexVideo } from "@/lib/modules/video/domain/video-visibility";

beforeEach(() => {
  hoisted.videoFindMany.mockClear();
  hoisted.videoFindFirst.mockClear();
  hoisted.videoGroupBy.mockClear();
});

const firstWhere = (mock: typeof hoisted.videoFindMany) => (mock.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;

describe("UNLISTED stays off every public list", () => {
  it("buildPublicVideoWhere (home list, sidebar, hero) is PUBLISHED only", async () => {
    expect((await buildPublicVideoWhere()).status).toBe("PUBLISHED");
  });

  it("sitemap query is PUBLISHED only", async () => {
    await VideoContentService.getSitemapVideos();
    expect(firstWhere(hoisted.videoFindMany).status).toBe("PUBLISHED");
  });

  it("the subscriptions stream is PUBLISHED only", async () => {
    await VideoContentService.getLatestPublicVideosForChannels(["c1"]);
    expect(firstWhere(hoisted.videoFindMany).status).toBe("PUBLISHED");
  });

  it("the sidebar/list query (getAllVideos) is PUBLISHED only", async () => {
    await VideoContentService.getAllVideos();
    expect(firstWhere(hoisted.videoFindMany).status).toBe("PUBLISHED");
  });

  it("the list query leaves heavy and internal columns out (W03)", async () => {
    await VideoContentService.getAllVideos();
    const args = (hoisted.videoFindMany.mock.calls[0] as unknown as [{ omit?: Record<string, boolean> }])[0];
    // The descriptions are loaded for the open video only (getPublicVideoDetail), not for the whole list.
    expect(args.omit).toMatchObject({ description: true, descriptionEn: true, searchText: true, chapters: true });
    for (const needed of ["title", "titleEn", "tags", "category", "thumbnailPublicUrl", "fundraisingGoalMinor"]) {
      expect(args.omit).not.toHaveProperty(needed);
    }
  });

  it("search is PUBLISHED only", async () => {
    await VideoSearchService.searchPublicVideos("kot");
    expect(firstWhere(hoisted.videoFindMany).status).toBe("PUBLISHED");
  });

  it("the main featured (hero) lookup is PUBLISHED only", async () => {
    await VideoContentService.getMainFeaturedVideo().catch(() => null);
    const calls = hoisted.videoFindFirst.mock.calls as unknown as Array<[{ where: { status: string } }]>;
    expect(calls.length).toBeGreaterThan(0);
    for (const [arg] of calls) expect(arg.where.status).toBe("PUBLISHED");
  });

  it("the repository list and hero queries are PUBLISHED only", async () => {
    const db = { video: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) } };
    const repository = new VideoRepository(db as never);
    await repository.findPublicList("main-channel", new Date());
    await repository.findHero("main-channel", new Date());
    expect((db.video.findMany.mock.calls[0] as unknown as [{ where: { status: string } }])[0].where.status).toBe("PUBLISHED");
    expect((db.video.findFirst.mock.calls[0] as unknown as [{ where: { status: string } }])[0].where.status).toBe("PUBLISHED");
  });

  it("policy and channel where-builders are PUBLISHED only", () => {
    expect(VideoPolicy.buildPublicWhere("c", new Date()).status).toBe("PUBLISHED");
    expect(MainChannelPolicy.buildPublicMainChannelVideoWhere("c").status).toBe("PUBLISHED");
  });

  it("the sidebar and hero blockers refuse an unlisted video", () => {
    expect(VideoPolicy.getSidebarBlockers({ status: "UNLISTED" } as never).length).toBe(1);
    expect(VideoPolicy.isPubliclyVisible({ status: "UNLISTED", publishedAt: new Date(0) } as never, new Date())).toBe(false);
  });
});

describe("UNLISTED is reachable by link and never indexed", () => {
  const channel = { status: "ACTIVE", deletedAt: null };
  const due = new Date("2026-01-01T00:00:00Z");

  it("by-link visibility accepts PUBLISHED and UNLISTED only", () => {
    expect(isVideoPubliclyVisible({ status: "UNLISTED", publishedAt: due, creator: channel })).toBe(true);
    expect(isVideoPubliclyVisible({ status: "PUBLISHED", publishedAt: due, creator: channel })).toBe(true);
    expect(isVideoPubliclyVisible({ status: "DRAFT", publishedAt: due, creator: channel })).toBe(false);
    expect(isVideoPubliclyVisible({ status: "ARCHIVED", publishedAt: due, creator: channel })).toBe(false);
  });

  it("an unlisted video on a hidden channel or removed by moderation is still refused", () => {
    expect(isVideoPubliclyVisible({ status: "UNLISTED", publishedAt: due, creator: { status: "SUSPENDED", deletedAt: null } })).toBe(false);
    expect(isVideoPubliclyVisible({ status: "UNLISTED", publishedAt: due, moderationStatus: "REMOVED", creator: channel })).toBe(false);
  });

  it("status helpers and noindex", () => {
    expect(isListedStatus("UNLISTED")).toBe(false);
    expect(isListedStatus("PUBLISHED")).toBe(true);
    expect(isLinkAccessibleStatus("UNLISTED")).toBe(true);
    expect(shouldNoIndexVideo({ status: "UNLISTED" })).toBe(true);
    expect(shouldNoIndexVideo({ status: "PUBLISHED", isAdult: true })).toBe(true);
    expect(shouldNoIndexVideo({ status: "PUBLISHED", moderationStatus: "AGE_RESTRICTED" })).toBe(true);
    expect(shouldNoIndexVideo({ status: "PUBLISHED" })).toBe(false);
  });
});
