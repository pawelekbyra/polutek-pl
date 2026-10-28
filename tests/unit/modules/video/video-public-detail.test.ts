import { beforeEach, describe, expect, it, vi } from "vitest";

const { videoFindFirst } = vi.hoisted(() => ({ videoFindFirst: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { video: { findFirst: videoFindFirst } } }));

import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";

const visible = {
  id: "v1",
  description: "Opis",
  descriptionEn: "Description",
  status: "PUBLISHED",
  publishedAt: new Date("2026-01-01"),
  moderationStatus: "NONE",
  creator: { status: "ACTIVE", deletedAt: null },
};

describe("VideoContentService.getPublicVideoDetail (W03)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the descriptions of a publicly visible video", async () => {
    videoFindFirst.mockResolvedValue(visible);
    expect(await VideoContentService.getPublicVideoDetail("v1")).toEqual({ id: "v1", description: "Opis", descriptionEn: "Description" });
    // Reads the description columns and the visibility facts, nothing else.
    expect(Object.keys(videoFindFirst.mock.calls[0]![0].select).sort()).toEqual(
      ["creator", "description", "descriptionEn", "id", "moderationStatus", "publishedAt", "status"],
    );
  });

  it.each([
    ["removed by moderation", { moderationStatus: "REMOVED" }],
    ["not yet due", { publishedAt: new Date(Date.now() + 86_400_000) }],
    ["a draft", { status: "DRAFT" }],
    ["on a hidden channel", { creator: { status: "SUSPENDED", deletedAt: null } }],
  ])("answers null for a video %s", async (_label, patch) => {
    videoFindFirst.mockResolvedValue({ ...visible, ...patch });
    expect(await VideoContentService.getPublicVideoDetail("v1")).toBeNull();
  });

  it("answers null for an unknown video and for a silly key", async () => {
    videoFindFirst.mockResolvedValue(null);
    expect(await VideoContentService.getPublicVideoDetail("nope")).toBeNull();
    expect(await VideoContentService.getPublicVideoDetail("x".repeat(500))).toBeNull();
  });

  it("maps a list row without description to a DTO without the key, and with one to a DTO with it", () => {
    const base = { id: "v1", creatorId: "c", title: "T", slug: "t", thumbnailUrl: "", tier: "PUBLIC", status: "PUBLISHED" };
    expect(VideoContentService.mapToPublicVideoDTO(base)).not.toHaveProperty("description");
    expect(VideoContentService.mapToPublicVideoDTO({ ...base, description: null, descriptionEn: null })).toMatchObject({ description: null });
  });
});
