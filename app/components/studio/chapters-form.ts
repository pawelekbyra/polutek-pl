/**
 * Pure rules of the Studio chapter editor (no React, no I/O): editor rows <-> `Chapter[]`, the time text, live
 * validation, the import from a description and the texts of the problems. The rules themselves live in
 * `lib/video-chapters.ts` (shared with the server, which stays the authority).
 */

import {
  CHAPTERS_MAX,
  CHAPTERS_MIN,
  CHAPTER_MIN_GAP_SECONDS,
  CHAPTER_TITLE_MAX,
  normalizeChapters,
  parseChaptersFromDescription,
  validateChapters,
  type Chapter,
  type ChapterProblem,
  type SkippedLineReason,
} from "@/lib/video-chapters";
import { formatClock, parseStartTime } from "@/lib/video-start-time";
import type { Tx } from "@/lib/i18n/ui";

/** One line of the editor. The time is what the creator typed ("1:30"); `key` only identifies the line for React. */
export interface ChapterRow {
  key: string;
  time: string;
  title: string;
  titleEn: string;
}

/** Seconds a new line is placed after the last one. */
export const NEW_ROW_STEP_SECONDS = 60;

let rowCounter = 0;
function nextKey(): string {
  rowCounter += 1;
  return `chapter-${rowCounter}`;
}

export function chapterRows(chapters: readonly Chapter[]): ChapterRow[] {
  return chapters.map((chapter) => ({ key: nextKey(), time: formatClock(chapter.startSeconds), title: chapter.title, titleEn: chapter.titleEn ?? "" }));
}

/** A new line one minute after the last one (or at 0:00 in an empty list). */
export function newChapterRow(rows: readonly ChapterRow[]): ChapterRow {
  const last = rows.length > 0 ? parseStartTime(rows[rows.length - 1]!.time) : null;
  return { key: nextKey(), time: formatClock(last === null ? 0 : last + NEW_ROW_STEP_SECONDS), title: "", titleEn: "" };
}

/** Rows sorted by their time; a line whose time cannot be read keeps its place at the end. Stable for equal times. */
export function sortRows(rows: readonly ChapterRow[]): ChapterRow[] {
  const at = (row: ChapterRow) => parseStartTime(row.time) ?? Number.POSITIVE_INFINITY;
  return [...rows].sort((a, b) => at(a) - at(b));
}

/** The time as the editor shows it ("1:30", "1:02:03") once it is committed; unreadable text is left alone. */
export function commitTime(text: string): string {
  const seconds = parseStartTime(text);
  return seconds === null ? text.trim() : formatClock(seconds);
}

/** The chapters in row order (no sorting, so ordering problems are visible); an unreadable time becomes -1. */
function rowsAsChapters(rows: readonly ChapterRow[]): Chapter[] {
  return rows.map((row) => {
    const chapter: Chapter = { startSeconds: parseStartTime(row.time) ?? -1, title: row.title.trim() };
    const en = row.titleEn.trim();
    if (en) chapter.titleEn = en;
    return chapter;
  });
}

/** Every problem of the editor list, indexed by row. An empty list is valid (no chapters). */
export function rowProblems(rows: readonly ChapterRow[], durationSeconds?: number | null): ChapterProblem[] {
  return validateChapters(rowsAsChapters(rows), durationSeconds);
}

/** What `PATCH` sends: the cleaned list, or `null` for an empty one (clears the chapters). Only for a valid list. */
export function chaptersPayload(rows: readonly ChapterRow[]): Chapter[] | null {
  const chapters = normalizeChapters(rowsAsChapters(rows));
  return chapters.length > 0 ? chapters : null;
}

/** True when two editor lists mean the same chapters (the line keys are not compared). */
export function areChaptersEqual(a: readonly ChapterRow[] | undefined, b: readonly ChapterRow[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((row, i) => row.time === right[i]!.time && row.title === right[i]!.title && row.titleEn === right[i]!.titleEn);
}

export interface ChaptersImport {
  rows: ChapterRow[];
  skipped: { line: number; text: string; reason: SkippedLineReason }[];
}

/**
 * Chapters from the descriptions in the form. The Polish description gives the list; when the English description
 * has the same times, its titles go to the English column. Nothing is added or repaired (0:00 and the gaps stay
 * the creator's to fix), and nothing is saved before the creator saves the form.
 */
export function importFromDescriptions(description: string, descriptionEn: string): ChaptersImport {
  const pl = parseChaptersFromDescription(description);
  const en = parseChaptersFromDescription(descriptionEn);
  const english = new Map(en.chapters.map((chapter) => [chapter.startSeconds, chapter.title]));
  const chapters: Chapter[] = pl.chapters.map((chapter) => {
    const title = english.get(chapter.startSeconds);
    return title ? { ...chapter, titleEn: title } : chapter;
  });
  return { rows: chapterRows(chapters), skipped: pl.skipped };
}

export function skippedReasonText(reason: SkippedLineReason, tx: Tx): string {
  if (reason === "NO_TITLE") return tx("brak tytułu", "no title");
  if (reason === "DUPLICATE_START") return tx("ten czas już jest na liście", "this time is already on the list");
  return tx("czas dłuższy niż 24 godziny", "time longer than 24 hours");
}

/** The message of a problem (Polish and English; the other languages come from the catalogs). */
export function problemText(problem: ChapterProblem, tx: Tx): string {
  switch (problem.code) {
    case "FIRST_NOT_ZERO":
      return tx("Pierwszy rozdział musi zaczynać się w 0:00.", "The first chapter must start at 0:00.");
    case "TOO_FEW":
      return tx("Dodaj co najmniej {0} rozdziały.", "Add at least {0} chapters.", CHAPTERS_MIN);
    case "TOO_MANY":
      return tx("Najwyżej {0} rozdziałów.", "At most {0} chapters.", CHAPTERS_MAX);
    case "NOT_ASCENDING":
    case "DUPLICATE_START":
    case "TOO_CLOSE":
      return tx("Rozdziały muszą być w kolejności i co najmniej {0} s od siebie.", "Chapters must be in order and at least {0} s apart.", CHAPTER_MIN_GAP_SECONDS);
    case "BEYOND_DURATION":
      return tx("Czas poza długością filmu.", "Time beyond the length of the video.");
    case "TITLE_EMPTY":
      return tx("Tytuł nie może być pusty.", "The title cannot be empty.");
    case "TITLE_TOO_LONG":
      return tx("Tytuł może mieć najwyżej {0} znaków.", "The title can be at most {0} characters.", CHAPTER_TITLE_MAX);
    case "INVALID_TIME":
      return tx("Nieprawidłowy czas (np. 12:30).", "Invalid time (e.g. 12:30).");
  }
}
