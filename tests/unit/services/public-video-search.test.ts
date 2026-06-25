import { describe, expect, it } from "vitest";
import { AccessTier, VideoStatus } from "@prisma/client";
import type { PublicVideoDTO } from "@/app/types/video";
import {
  normalizePublicVideoSearchQuery,
  searchPublicVideos,
} from "@/lib/services/public-video-search";

const makeVideo = (overrides: Partial<PublicVideoDTO>): PublicVideoDTO => ({
  id: overrides.id ?? "v1",
  creatorId: "creator-1",
  title: overrides.title ?? "Zażółć gęślą jaźń",
  titleEn: overrides.titleEn ?? null,
  slug: overrides.slug ?? "zazolc-gesla-jazn",
  description: overrides.description ?? null,
  descriptionEn: overrides.descriptionEn ?? null,
  thumbnailUrl: overrides.thumbnailUrl ?? "/thumb.jpg",
  duration: null,
  tier: AccessTier.PUBLIC,
  status: VideoStatus.PUBLISHED,
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  isMainFeatured: false,
  sidebarOrder: 0,
  publishedAt: new Date("2026-06-01T00:00:00Z"),
  creator: undefined,
});

describe("public video search", () => {
  it("trims, lowercases, normalizes whitespace, and removes Polish diacritics", () => {
    expect(normalizePublicVideoSearchQuery("  ZAŻÓŁĆ   GĘŚLĄ\nJAŹŃ  ")).toBe(
      "zazolc gesla jazn",
    );
  });

  it("matches title, English title, descriptions, and slug with normalized queries", () => {
    const videos = [
      makeVideo({ id: "title", title: "Łódź i źródła" }),
      makeVideo({ id: "title-en", title: "Inny", titleEn: "English Evidence" }),
      makeVideo({
        id: "description",
        title: "Inny",
        description: "Opis o żółwiu",
      }),
      makeVideo({
        id: "description-en",
        title: "Inny",
        descriptionEn: "Hidden testimony",
      }),
      makeVideo({ id: "slug", title: "Inny", slug: "polish-public-video" }),
    ];

    expect(
      searchPublicVideos(videos, "zrodla").map((video) => video.id),
    ).toEqual(["title"]);
    expect(
      searchPublicVideos(videos, "english evidence").map((video) => video.id),
    ).toEqual(["title-en"]);
    expect(
      searchPublicVideos(videos, "zolwiu").map((video) => video.id),
    ).toEqual(["description"]);
    expect(
      searchPublicVideos(videos, "testimony").map((video) => video.id),
    ).toEqual(["description-en"]);
    expect(
      searchPublicVideos(videos, "public video").map((video) => video.id),
    ).toEqual(["slug"]);
  });

  it("returns no results for empty normalized queries", () => {
    expect(searchPublicVideos([makeVideo({})], "   ")).toEqual([]);
  });
});
