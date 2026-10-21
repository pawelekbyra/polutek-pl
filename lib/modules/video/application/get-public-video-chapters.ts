import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseStoredChapters, type Chapter } from "@/lib/video-chapters";
import { buildChapterClips, canExposeChapterClips, type ChapterClip } from "@/lib/video-chapters-seo";

export interface PublicVideoChapters {
  chapters: Chapter[];
  durationSeconds: number | null;
}

/**
 * The chapters of a video for the page's structured data (docs/architecture/video-chapters.md section 9): one read,
 * per request (React `cache`), and only for a `PUBLIC`, `PUBLISHED` video. The tier is the raw column, so `PAID` and
 * `LOGGED_IN` videos return nothing here; chapters of those reach viewers only through the playback plan.
 * Stored content that is not a valid list reads as no chapters.
 */
export const getPublicVideoChapters = cache(async (videoId: string): Promise<PublicVideoChapters | null> => {
  const row = await prisma.video.findFirst({
    where: { id: videoId, tier: "PUBLIC", status: "PUBLISHED" },
    select: { chapters: true, durationSeconds: true },
  });
  if (!row) return null;
  const chapters = parseStoredChapters(row.chapters);
  return chapters.length > 0 ? { chapters, durationSeconds: row.durationSeconds } : null;
});

/**
 * The `hasPart` clips for the page of `video`, or null. Reads the database only when the video may expose chapters
 * at all (so no extra query for other videos).
 */
export async function getPublicChapterClips(input: {
  video: { id: string; slug: string; tier?: string | null; status?: string | null; isAdult?: boolean | null; moderationStatus?: string | null; premiumPass?: boolean };
  language: string;
  pageUrl: string;
}): Promise<ChapterClip[] | null> {
  if (!canExposeChapterClips(input.video)) return null;
  if (input.video.premiumPass) return null; // patron zone (docs/architecture/patron-zone.md): no chapter titles of a pass video
  const found = await getPublicVideoChapters(input.video.id);
  if (!found) return null;
  return buildChapterClips({ chapters: found.chapters, durationSeconds: found.durationSeconds, language: input.language, pageUrl: input.pageUrl, slug: input.video.slug });
}
