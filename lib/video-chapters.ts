/**
 * Video chapters ("0:00 Intro", like YouTube): the one pure definition shared by the Studio editor, the update use
 * case, the playback plan, the player and the tests. No I/O, no React, no Prisma (docs/architecture/video-chapters.md).
 *
 * Stored in `Video.chapters` (JSONB, NULL = none) and always read through `parseStoredChapters()`, so bad content in
 * the column means "no chapters", never an exception.
 */
import { MAX_START_SECONDS } from "@/lib/video-start-time";

/** Fewest chapters of a list (like YouTube); an empty list means "no chapters". The one constant to change. */
export const CHAPTERS_MIN = 3;
export const CHAPTERS_MAX = 50;
/** Every chapter starts at least this many seconds after the previous one (and this long before the end). */
export const CHAPTER_MIN_GAP_SECONDS = 10;
export const CHAPTER_TITLE_MAX = 80;

export interface Chapter {
  startSeconds: number;
  title: string;
  titleEn?: string;
}

/** A chapter as a request carries it (`titleEn: null` = none); `normalizeChapters` turns it into a `Chapter`. */
export type ChapterInput = Omit<Chapter, "titleEn"> & { titleEn?: string | null };

export type ChapterProblemCode =
  | "TOO_FEW"
  | "TOO_MANY"
  | "FIRST_NOT_ZERO"
  | "NOT_ASCENDING"
  | "DUPLICATE_START"
  | "TOO_CLOSE"
  | "BEYOND_DURATION"
  | "TITLE_EMPTY"
  | "TITLE_TOO_LONG"
  | "INVALID_TIME";

export interface ChapterProblem {
  code: ChapterProblemCode;
  /** The chapter the problem is about; absent for list-wide problems (TOO_FEW, TOO_MANY). */
  index?: number;
}

// ASCII and Unicode control characters (new lines and tabs included) become spaces.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

/** Characters, not UTF-16 units (an emoji is one), like the tags. */
function textLength(value: string): number {
  return [...value].length;
}

/**
 * Cleans a raw list (the request body, the stored JSON, the editor rows): trims, single spaces, no control
 * characters, sorted by start time. Entries that are not objects, have no finite start time or no string title are
 * dropped as garbage; empty titles and out-of-range times stay so that `validateChapters` can report them.
 */
export function normalizeChapters(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];
  const out: Chapter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { startSeconds, title, titleEn } = item as Record<string, unknown>;
    if (typeof startSeconds !== "number" || !Number.isFinite(startSeconds) || typeof title !== "string") continue;
    const chapter: Chapter = { startSeconds: Math.floor(startSeconds), title: cleanText(title) };
    if (typeof titleEn === "string") {
      const en = cleanText(titleEn);
      if (en) chapter.titleEn = en;
    }
    out.push(chapter);
  }
  // Array.prototype.sort is stable: equal times keep the order they came in.
  return out.sort((a, b) => a.startSeconds - b.startSeconds);
}

/**
 * Every problem of a (normalized) list; an empty result means it is valid. An empty list is valid (no chapters).
 * `durationSeconds` is the video length when known: a chapter must then start at least 10 s before the end.
 */
export function validateChapters(chapters: readonly Chapter[], durationSeconds?: number | null): ChapterProblem[] {
  const problems: ChapterProblem[] = [];
  if (chapters.length === 0) return problems;
  if (chapters.length < CHAPTERS_MIN) problems.push({ code: "TOO_FEW" });
  if (chapters.length > CHAPTERS_MAX) problems.push({ code: "TOO_MANY" });
  const duration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.floor(durationSeconds) : null;

  chapters.forEach((chapter, index) => {
    const start = chapter.startSeconds;
    const validTime = Number.isInteger(start) && start >= 0 && start <= MAX_START_SECONDS;
    if (!validTime) problems.push({ code: "INVALID_TIME", index });
    if (!chapter.title.trim()) problems.push({ code: "TITLE_EMPTY", index });
    else if (textLength(chapter.title) > CHAPTER_TITLE_MAX) problems.push({ code: "TITLE_TOO_LONG", index });
    else if (chapter.titleEn !== undefined && textLength(chapter.titleEn) > CHAPTER_TITLE_MAX) problems.push({ code: "TITLE_TOO_LONG", index });
    if (!validTime) return;
    if (index === 0 && start !== 0) problems.push({ code: "FIRST_NOT_ZERO", index });
    if (index > 0) {
      const gap = start - chapters[index - 1].startSeconds;
      if (gap < 0) problems.push({ code: "NOT_ASCENDING", index });
      else if (gap === 0) problems.push({ code: "DUPLICATE_START", index });
      else if (gap < CHAPTER_MIN_GAP_SECONDS) problems.push({ code: "TOO_CLOSE", index });
    }
    if (duration !== null && start > duration - CHAPTER_MIN_GAP_SECONDS) problems.push({ code: "BEYOND_DURATION", index });
  });
  return problems;
}

/**
 * Chapters as stored in the database. Anything that is not a structurally valid list (not an array, too few, too
 * many, wrong order, bad titles) reads as "no chapters". The length of the video is not known here.
 */
export function parseStoredChapters(value: unknown): Chapter[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > CHAPTERS_MAX) return [];
  const chapters = normalizeChapters(value);
  if (chapters.length !== value.length) return [];
  return validateChapters(chapters).length === 0 ? chapters : [];
}

/** The chapter title in the viewer's language: Polish keeps `title`, every other language reads the English text. */
export function pickChapterTitle(chapter: Chapter, language: string): string {
  if (language === "pl") return chapter.title;
  return chapter.titleEn?.trim() || chapter.title;
}

/** Index of the chapter that contains `seconds` (the last one that has started); -1 when there is none. */
export function activeChapterIndex(chapters: readonly Chapter[], seconds: number): number {
  if (!Number.isFinite(seconds)) return -1;
  let found = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startSeconds <= seconds) found = i;
    else break;
  }
  return found;
}

/** A chapter that has run longer than this is restarted by "previous" instead of going back one chapter. */
const RESTART_THRESHOLD_SECONDS = 3;

/**
 * Where the "next" (1) or "previous" (-1) chapter key goes. Next: the start of the following chapter (null on the
 * last one). Previous: the start of the current chapter when it has run for more than 3 s, otherwise the one before
 * it (the first chapter restarts at its own start). Null when there is nowhere to go.
 */
export function adjacentChapterStart(chapters: readonly Chapter[], seconds: number, dir: -1 | 1): number | null {
  if (chapters.length === 0 || !Number.isFinite(seconds)) return null;
  const current = activeChapterIndex(chapters, seconds);
  if (dir === 1) return current + 1 < chapters.length ? chapters[current + 1].startSeconds : null;
  if (current < 0) return null;
  if (seconds - chapters[current].startSeconds > RESTART_THRESHOLD_SECONDS || current === 0) return chapters[current].startSeconds;
  return chapters[current - 1].startSeconds;
}

/** End of a chapter: the start of the next one, and for the last one the length of the video. */
export function chapterWindowEnd(chapters: readonly Chapter[], index: number, durationSeconds: number): number {
  const next = chapters[index + 1];
  return next ? next.startSeconds : durationSeconds;
}

/**
 * Chapters laid out over a video of the given length, for the progress bar. Chapters that start at or after the end
 * are left out (the length of a re-uploaded video may have changed); an unknown length gives no segments.
 */
export function buildChapterSegments(chapters: readonly Chapter[], durationSeconds: number): { start: number; end: number; title: string }[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const inside = chapters.filter((chapter) => chapter.startSeconds < durationSeconds);
  return inside.map((chapter, index) => ({
    start: chapter.startSeconds,
    end: chapterWindowEnd(inside, index, durationSeconds),
    title: chapter.title,
  }));
}

/** A timestamp found in a text: `m:ss`, `mm:ss`, `h:mm:ss` or `hh:mm:ss`. */
export interface TimestampMatch {
  index: number;
  length: number;
  seconds: number;
}

// Not glued to other digits or colons on either side. Three parts (h:mm:ss) are tried before two (m:ss).
const TIMESTAMP = /(?<![\d:])(\d{1,2}):([0-5]\d)(?::([0-5]\d))?(?!\d|:\d)/g;

function secondsOf(first: string, second: string, third: string | undefined): number {
  return third !== undefined ? Number(first) * 3600 + Number(second) * 60 + Number(third) : Number(first) * 60 + Number(second);
}

/**
 * Every timestamp in a text, in order. The one grammar of chapter times: the description import and the clickable
 * times in the description share it. A time beyond 24 hours is not a timestamp.
 */
export function scanTimestamps(text: string): TimestampMatch[] {
  const found: TimestampMatch[] = [];
  if (!text) return found;
  const pattern = new RegExp(TIMESTAMP.source, "g");
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const seconds = secondsOf(match[1], match[2], match[3]);
    if (seconds > MAX_START_SECONDS) continue;
    found.push({ index: match.index, length: match[0].length, seconds });
  }
  return found;
}

export type SkippedLineReason = "NO_TITLE" | "DUPLICATE_START" | "INVALID_TIME";

export interface DescriptionChapters {
  chapters: Chapter[];
  skipped: { line: number; text: string; reason: SkippedLineReason }[];
}

// Optional bullet, optional opening bracket, the time at the start of the line, optional closing bracket, separators, title.
const LINE_PREFIX = /^[\s\-*\u2022\u2013\u2014>]*[[(]?\s*/;
const LINE_TIME = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?(?!\d|:\d)/;
const LINE_SEPARATORS = /^[\s\-\u2013\u2014:|\u00b7)\]]*/;

/**
 * Reads chapters from a description: one per line, the time at the very start (after an optional bullet or bracket;
 * times inside a sentence are not chapters, like on YouTube). Lines without a time are ignored; a line with a time
 * but no title, a repeated time (the first wins) or a time beyond 24 hours is reported in `skipped`. It never adds a
 * missing 0:00 or repairs gaps: the creator fixes those in the editor after seeing the validation messages.
 */
export function parseChaptersFromDescription(text: string): DescriptionChapters {
  const chapters: Chapter[] = [];
  const skipped: DescriptionChapters["skipped"] = [];
  const seen = new Set<number>();
  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;
    const rest = line.slice((LINE_PREFIX.exec(line)?.[0] ?? "").length);
    const time = LINE_TIME.exec(rest);
    if (!time) return;
    const seconds = secondsOf(time[1], time[2], time[3]);
    const afterTime = rest.slice(time[0].length);
    const title = cleanText(afterTime.slice((LINE_SEPARATORS.exec(afterTime)?.[0] ?? "").length));
    const report = (reason: SkippedLineReason) => skipped.push({ line: lineIndex + 1, text: line.slice(0, 120), reason });
    if (seconds > MAX_START_SECONDS) return report("INVALID_TIME");
    if (!title) return report("NO_TITLE");
    if (seen.has(seconds)) return report("DUPLICATE_START");
    seen.add(seconds);
    chapters.push({ startSeconds: seconds, title });
  });
  chapters.sort((a, b) => a.startSeconds - b.startSeconds);
  return { chapters, skipped };
}
