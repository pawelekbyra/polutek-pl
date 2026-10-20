import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { video: { findFirst: hoisted.findFirst } } }));

import { getPublicChapterClips, getPublicVideoChapters } from "@/lib/modules/video/application/get-public-video-chapters";

const STORED = [
  { startSeconds: 0, title: "Wstęp", titleEn: "Intro" },
  { startSeconds: 20, title: "Temat" },
  { startSeconds: 45, title: "Koniec" },
];
const video = { id: "v1", slug: "film", tier: "PUBLIC", status: "PUBLISHED", isAdult: false };
const input = { video, language: "pl", pageUrl: "https://example.test" };

beforeEach(() => hoisted.findFirst.mockReset());

describe("getPublicVideoChapters", () => {
  it("reads one row, only for a PUBLIC and PUBLISHED video (the raw tier column)", async () => {
    hoisted.findFirst.mockResolvedValue({ chapters: STORED, durationSeconds: 120 });
    const result = await getPublicVideoChapters("v1");
    expect(hoisted.findFirst).toHaveBeenCalledTimes(1);
    expect(hoisted.findFirst).toHaveBeenCalledWith({ where: { id: "v1", tier: "PUBLIC", status: "PUBLISHED" }, select: { chapters: true, durationSeconds: true } });
    expect(result).toEqual({ chapters: STORED, durationSeconds: 120 });
  });
  it("returns null when the video is not public (no row) or has no usable chapters", async () => {
    hoisted.findFirst.mockResolvedValueOnce(null);
    expect(await getPublicVideoChapters("a")).toBeNull();
    hoisted.findFirst.mockResolvedValueOnce({ chapters: null, durationSeconds: 120 });
    expect(await getPublicVideoChapters("b")).toBeNull();
    hoisted.findFirst.mockResolvedValueOnce({ chapters: { not: "a list" }, durationSeconds: 120 });
    expect(await getPublicVideoChapters("c")).toBeNull();
    hoisted.findFirst.mockResolvedValueOnce({ chapters: [{ startSeconds: 5, title: "no zero" }], durationSeconds: 120 });
    expect(await getPublicVideoChapters("d")).toBeNull();
  });
});

describe("getPublicChapterClips", () => {
  it("builds the clips for a public video", async () => {
    hoisted.findFirst.mockResolvedValue({ chapters: STORED, durationSeconds: 120 });
    const clips = await getPublicChapterClips(input);
    expect(clips?.map((clip) => [clip.name, clip.startOffset, clip.endOffset, clip.url])).toEqual([
      ["Wstęp", 0, 20, "https://example.test?v=film&t=0"],
      ["Temat", 20, 45, "https://example.test?v=film&t=20"],
      ["Koniec", 45, 120, "https://example.test?v=film&t=45"],
    ]);
  });
  it("does not touch the database for a video that may not expose chapters", async () => {
    for (const hidden of [{ tier: "LOGGED_IN" }, { tier: "PAID" }, { status: "UNLISTED" }, { isAdult: true }]) {
      expect(await getPublicChapterClips({ ...input, video: { ...video, ...hidden } })).toBeNull();
    }
    expect(hoisted.findFirst).not.toHaveBeenCalled();
  });
  it("gives nothing when the length is unknown or under 30 s", async () => {
    hoisted.findFirst.mockResolvedValueOnce({ chapters: STORED, durationSeconds: null });
    expect(await getPublicChapterClips(input)).toBeNull();
    hoisted.findFirst.mockResolvedValueOnce({ chapters: STORED, durationSeconds: 29 });
    expect(await getPublicChapterClips(input)).toBeNull();
  });
});
