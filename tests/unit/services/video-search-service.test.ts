import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessTier, VideoStatus } from "@prisma/client";

const findMany = vi.fn();
const getOptional = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { video: { findMany } } }));
vi.mock("@/lib/modules/channel", () => ({
  MainChannelService: { getOptional },
}));

const pick = (overrides: any, key: string, fallback: any) => Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback;

const row = (overrides: any = {}) => ({
  id: pick(overrides, "id", "v1"),
  creatorId: pick(overrides, "creatorId", "creator-main"),
  title: pick(overrides, "title", "Film testowy"),
  titleEn: pick(overrides, "titleEn", null),
  slug: pick(overrides, "slug", "film-testowy"),
  description: pick(overrides, "description", null),
  descriptionEn: pick(overrides, "descriptionEn", null),
  thumbnailUrl: pick(overrides, "thumbnailUrl", "/thumb.jpg"),
  duration: null,
  tier: pick(overrides, "tier", AccessTier.PUBLIC),
  status: pick(overrides, "status", VideoStatus.PUBLISHED),
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  isMainFeatured: false,
  sidebarOrder: pick(overrides, "sidebarOrder", 0),
  publishedAt: pick(overrides, "publishedAt", new Date("2026-06-01T00:00:00Z")),
  createdAt: pick(overrides, "createdAt", new Date("2026-05-01T00:00:00Z")),
  creator: overrides.creator ?? {
    id: pick(overrides, "creatorId", "creator-main"),
    name: "Paweł Byra",
    slug: "pawel",
    subscribersCount: 0,
    user: { imageUrl: null, email: "test@example.com" },
  },
});

describe("VideoSearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOptional.mockResolvedValue({ id: "creator-main" });
    findMany.mockResolvedValue([]);
  });

  it("normalizes diacritics, ł, case, whitespace, hyphens and underscores", async () => {
    const { VideoSearchService } = await import("@/lib/modules/video/application/video-search.service");
    expect(VideoSearchService.normalizeQuery("  ŻÓŁĆ  ")).toBe("zolc");
    expect(VideoSearchService.normalizeQuery("test-film__NOWY   odcinek")).toBe("test film nowy odcinek");
    expect(VideoSearchService.normalizeQuery(null)).toBe("");
  });

  it("queries the public metadata catalog without showInSidebar and includes all public-visible tiers", async () => {
    const { VideoSearchService } = await import("@/lib/modules/video/application/video-search.service");
    findMany.mockResolvedValue([
      row({ id: "public", title: "Szukaj", tier: AccessTier.PUBLIC }),
      row({ id: "logged", title: "Szukaj", tier: AccessTier.LOGGED_IN }),
      row({ id: "patron", title: "Szukaj", tier: AccessTier.PATRON }),
    ]);

    const results = await VideoSearchService.searchPublicVideos("szukaj");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        creatorId: "creator-main",
        status: VideoStatus.PUBLISHED,
        tier: { in: [AccessTier.PUBLIC, AccessTier.LOGGED_IN, AccessTier.PATRON] },
        creator: { isApproved: true, isPrimary: true },
      }),
    }));
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("showInSidebar");
    expect(results.map((video) => video.id).sort()).toEqual(["logged", "patron", "public"]);
  });

  it("matches title, titleEn, descriptions, slug and creator name", async () => {
    const { VideoSearchService } = await import("@/lib/modules/video/application/video-search.service");
    const videos = [
      row({ id: "title", title: "Tajemnica" }),
      row({ id: "title-en", title: "Inne", titleEn: "English Story" }),
      row({ id: "desc", title: "Inne", description: "Opis z żółcią" }),
      row({ id: "desc-en", title: "Inne", descriptionEn: "Hidden evidence" }),
      row({ id: "slug", title: "Inne", slug: "special-slug" }),
      row({ id: "creator", title: "Inne", creator: { id: "creator-main", name: "Kreator Search", slug: "k", subscribersCount: 0, user: {} } }),
    ];
    expect(VideoSearchService.rankVideos(videos as any, VideoSearchService.normalizeQuery("tajemnica"))[0].matchedFields).toContain("title");
    expect(VideoSearchService.rankVideos(videos as any, VideoSearchService.normalizeQuery("english story"))[0].matchedFields).toContain("titleEn");
    expect(VideoSearchService.rankVideos(videos as any, VideoSearchService.normalizeQuery("zolcia"))[0].matchedFields).toContain("description");
    expect(VideoSearchService.rankVideos(videos as any, VideoSearchService.normalizeQuery("hidden evidence"))[0].matchedFields).toContain("descriptionEn");
    expect(VideoSearchService.rankVideos(videos as any, VideoSearchService.normalizeQuery("special slug"))[0].matchedFields).toContain("slug");
    expect(VideoSearchService.rankVideos(videos as any, VideoSearchService.normalizeQuery("search"))[0].matchedFields).toContain("creator");
  });

  it("ranks exact and title matches above weaker matches with stable tie-breakers", async () => {
    const { VideoSearchService } = await import("@/lib/modules/video/application/video-search.service");
    const results = VideoSearchService.rankVideos([
      row({ id: "desc", title: "Other", description: "alpha" }),
      row({ id: "include", title: "Other alpha" }),
      row({ id: "starts", title: "Alpha beta" }),
      row({ id: "exact", title: "Alpha" }),
    ] as any, VideoSearchService.normalizeQuery("alpha"));
    expect(results.map((video) => video.id)).toEqual(["exact", "starts", "include", "desc"]);

    const slugVsDescription = VideoSearchService.rankVideos([
      row({ id: "desc-only", title: "Other", description: "needle" }),
      row({ id: "slug-hit", title: "Other", slug: "needle-video" }),
    ] as any, VideoSearchService.normalizeQuery("needle"));
    expect(slugVsDescription.map((video) => video.id)).toEqual(["slug-hit", "desc-only"]);

    const tied = VideoSearchService.rankVideos([
      row({ id: "b", title: "Tie", slug: "b" }),
      row({ id: "a", title: "Tie", slug: "a" }),
    ] as any, VideoSearchService.normalizeQuery("tie"));
    expect(tied.map((video) => video.id)).toEqual(["a", "b"]);
  });
});
