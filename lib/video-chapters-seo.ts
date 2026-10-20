/**
 * Chapters as schema.org `Clip` parts of a `VideoObject` (docs/architecture/video-chapters.md section 9). Pure: no I/O,
 * no React, no Prisma; the page and the tests share it. Google asks for `name`, `startOffset` and a `url` that opens
 * the video at that moment; it ignores clips of a video shorter than 30 s and of a video that cannot be opened at the
 * given time. Our `/?v=<slug>&t=<s>` is honoured on entry (`readPageStart`).
 */
import { CHAPTERS_MIN, pickChapterTitle, type Chapter } from "@/lib/video-chapters";
import { shouldNoIndexVideo } from "@/lib/modules/video/domain/video-visibility";

/** Google's floor for clips: the video must last at least this long. */
export const CLIP_MIN_VIDEO_SECONDS = 30;

export interface ChapterClip {
  "@type": "Clip";
  name: string;
  startOffset: number;
  endOffset: number;
  url: string;
}

/**
 * The address of a chapter: the page of the video with `v=<slug>` and `t=<seconds>`. Unlike `withStartTime`, the first
 * chapter keeps `t=0`: Google wants a time parameter on every clip.
 */
export function buildChapterClipUrl(pageUrl: string, slug: string, seconds: number): string {
  const start = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${pageUrl}?v=${encodeURIComponent(slug)}&t=${start}`;
}

/**
 * Whether a video's page may carry chapters in its structured data at all: listed (`PUBLISHED`), not 18+, and open to
 * everybody (`PUBLIC`, the effective tier, so `PAID` and `LOGGED_IN` never qualify). Tier is checked here and not
 * only in the query, because the structured data is public: a signed-in-only video gets no chapter titles in it.
 */
export function canExposeChapterClips(video: { tier?: string | null; status?: string | null; isAdult?: boolean | null; moderationStatus?: string | null }): boolean {
  return video.tier === "PUBLIC" && video.status === "PUBLISHED" && !shouldNoIndexVideo(video);
}

/**
 * The `hasPart` list for a video of `durationSeconds`, or `null` when Google would not use it: unknown or too short a
 * video, or fewer than `CHAPTERS_MIN` chapters left after dropping those that start at or after the end (the length
 * of a re-uploaded video may have changed). `endOffset` is the next chapter's start, the last one ends with the video.
 */
export function buildChapterClips(input: {
  chapters: readonly Chapter[];
  durationSeconds: number | null | undefined;
  language: string;
  pageUrl: string;
  slug: string;
}): ChapterClip[] | null {
  const { durationSeconds } = input;
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds < CLIP_MIN_VIDEO_SECONDS) return null;
  const inside = input.chapters.filter((chapter) => chapter.startSeconds < durationSeconds);
  if (inside.length < CHAPTERS_MIN) return null;
  return inside.map((chapter, index) => ({
    "@type": "Clip",
    name: pickChapterTitle(chapter, input.language),
    startOffset: chapter.startSeconds,
    endOffset: inside[index + 1]?.startSeconds ?? durationSeconds,
    url: buildChapterClipUrl(input.pageUrl, input.slug, chapter.startSeconds),
  }));
}
