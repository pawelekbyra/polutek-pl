import { describe, expect, it } from "vitest";
import { buildChapterClips, buildChapterClipUrl, canExposeChapterClips, CLIP_MIN_VIDEO_SECONDS } from "@/lib/video-chapters-seo";
import type { Chapter } from "@/lib/video-chapters";

const PAGE = "https://example.test";
const CHAPTERS: Chapter[] = [
  { startSeconds: 0, title: "Wstęp", titleEn: "Intro" },
  { startSeconds: 95, title: "Temat", titleEn: "Topic" },
  { startSeconds: 300, title: "Koniec" },
];
const clips = (over: Partial<Parameters<typeof buildChapterClips>[0]> = {}) =>
  buildChapterClips({ chapters: CHAPTERS, durationSeconds: 600, language: "pl", pageUrl: PAGE, slug: "moj-film", ...over });

describe("buildChapterClipUrl", () => {
  it("is the video page with v and t, and keeps t=0 for the first chapter", () => {
    expect(buildChapterClipUrl(PAGE, "moj-film", 120)).toBe("https://example.test?v=moj-film&t=120");
    expect(buildChapterClipUrl(PAGE, "moj-film", 0)).toBe("https://example.test?v=moj-film&t=0");
  });
  it("encodes the slug and floors the time", () => {
    expect(buildChapterClipUrl(PAGE, "a b&c", 12.9)).toBe("https://example.test?v=a%20b%26c&t=12");
    expect(buildChapterClipUrl(PAGE, "x", Number.NaN)).toBe("https://example.test?v=x&t=0");
  });
});

describe("buildChapterClips", () => {
  it("gives a Clip per chapter with the next start as end and the video length for the last", () => {
    expect(clips()).toEqual([
      { "@type": "Clip", name: "Wstęp", startOffset: 0, endOffset: 95, url: "https://example.test?v=moj-film&t=0" },
      { "@type": "Clip", name: "Temat", startOffset: 95, endOffset: 300, url: "https://example.test?v=moj-film&t=95" },
      { "@type": "Clip", name: "Koniec", startOffset: 300, endOffset: 600, url: "https://example.test?v=moj-film&t=300" },
    ]);
  });
  it("names the clips in the language of the page (English text, falling back to the Polish one)", () => {
    expect(clips({ language: "en" })?.map((clip) => clip.name)).toEqual(["Intro", "Topic", "Koniec"]);
  });
  it("gives no clips for an unknown or too short video (Google needs at least 30 s)", () => {
    expect(clips({ durationSeconds: null })).toBeNull();
    expect(clips({ durationSeconds: undefined })).toBeNull();
    expect(clips({ durationSeconds: CLIP_MIN_VIDEO_SECONDS - 1 })).toBeNull();
  });
  it("gives no clips for fewer than three chapters", () => {
    expect(clips({ chapters: CHAPTERS.slice(0, 2) })).toBeNull();
    expect(clips({ chapters: [] })).toBeNull();
  });
  it("drops chapters at or after the end, and nothing at all when too few remain", () => {
    const shorter = clips({ durationSeconds: 301 });
    expect(shorter).toHaveLength(3);
    expect(shorter?.[2].endOffset).toBe(301);
    expect(clips({ durationSeconds: 300 })).toBeNull();
    expect(clips({ durationSeconds: 200 })).toBeNull();
  });
  it("never repeats a start offset", () => {
    const starts = clips()?.map((clip) => clip.startOffset) ?? [];
    expect(new Set(starts).size).toBe(starts.length);
  });
  it("stays valid JSON after the page's escaping of angle brackets", () => {
    const json = JSON.stringify({ hasPart: clips({ chapters: [{ startSeconds: 0, title: "</script><b>" }, ...CHAPTERS.slice(1)] }) }).replace(/</g, "\\u003c");
    expect(json).not.toContain("<");
    expect(JSON.parse(json).hasPart[0].name).toBe("</script><b>");
  });
});

describe("canExposeChapterClips", () => {
  const video = { tier: "PUBLIC", status: "PUBLISHED", isAdult: false };
  it("is true only for a listed, non-adult PUBLIC video", () => {
    expect(canExposeChapterClips(video)).toBe(true);
  });
  it("is false for signed-in-only (which is also how PAID arrives in the DTO), unlisted, draft and adult videos", () => {
    expect(canExposeChapterClips({ ...video, tier: "LOGGED_IN" })).toBe(false);
    expect(canExposeChapterClips({ ...video, tier: "PAID" })).toBe(false);
    expect(canExposeChapterClips({ ...video, tier: undefined })).toBe(false);
    expect(canExposeChapterClips({ ...video, status: "UNLISTED" })).toBe(false);
    expect(canExposeChapterClips({ ...video, status: "DRAFT" })).toBe(false);
    expect(canExposeChapterClips({ ...video, isAdult: true })).toBe(false);
    expect(canExposeChapterClips({ ...video, moderationStatus: "AGE_RESTRICTED" })).toBe(false);
  });
});
