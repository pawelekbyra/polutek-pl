import { AppError } from "@/lib/modules/shared/app-error";
import { CHAPTERS_MAX, CHAPTERS_MIN, CHAPTER_MIN_GAP_SECONDS, CHAPTER_TITLE_MAX, normalizeChapters, validateChapters, type Chapter, type ChapterInput, type ChapterProblem } from "@/lib/video-chapters";
import { isVideoCategory, isVideoCommentsMode, normalizeTags, validateTags, VIDEO_TAG_MAX_LENGTH, VIDEO_TAGS_MAX, type VideoCommentsModeValue } from "@/lib/video-metadata";

export interface VideoMetadataInput {
  tags?: string[];
  category?: string | null;
  commentsMode?: string;
  /** `null` or `[]` clears the chapters; the entries may carry `titleEn: null`. */
  chapters?: ChapterInput[] | null;
}

export interface VideoMetadataFields {
  tags?: string[];
  category?: string | null;
  commentsMode?: VideoCommentsModeValue;
  /** `null` = clear. */
  chapters?: Chapter[] | null;
}

const CHAPTER_MESSAGES: Record<ChapterProblem["code"], string> = {
  TOO_FEW: `Dodaj co najmniej ${CHAPTERS_MIN} rozdziały.`,
  TOO_MANY: `Film może mieć najwyżej ${CHAPTERS_MAX} rozdziałów.`,
  FIRST_NOT_ZERO: "Pierwszy rozdział musi zaczynać się w 0:00.",
  NOT_ASCENDING: "Rozdziały muszą być w kolejności rosnącej.",
  DUPLICATE_START: "Dwa rozdziały nie mogą zaczynać się w tej samej sekundzie.",
  TOO_CLOSE: `Rozdziały muszą być oddalone o co najmniej ${CHAPTER_MIN_GAP_SECONDS} s.`,
  BEYOND_DURATION: "Rozdział zaczyna się poza długością filmu.",
  TITLE_EMPTY: "Tytuł rozdziału nie może być pusty.",
  TITLE_TOO_LONG: `Tytuł rozdziału może mieć najwyżej ${CHAPTER_TITLE_MAX} znaków.`,
  INVALID_TIME: "Nieprawidłowy czas rozdziału.",
};

/**
 * The creator metadata of a create/update, validated against the whitelists of `lib/video-metadata.ts`
 * (the route's zod schema is the first line; this keeps every other caller of the use cases honest).
 * Only fields that were sent come back, so an update never clears what it did not mention.
 */
export function resolveVideoMetadata(input: VideoMetadataInput, context: { durationSeconds?: number | null } = {}): VideoMetadataFields | AppError {
  const out: VideoMetadataFields = {};
  if (input.tags !== undefined) {
    const tags = normalizeTags(input.tags);
    const problem = validateTags(tags);
    if (problem === "TOO_MANY") return new AppError(`Film może mieć najwyżej ${VIDEO_TAGS_MAX} tagów.`, 400, "VIDEO_TAGS_TOO_MANY");
    if (problem === "TOO_LONG") return new AppError(`Tag może mieć najwyżej ${VIDEO_TAG_MAX_LENGTH} znaków.`, 400, "VIDEO_TAG_TOO_LONG");
    out.tags = tags;
  }
  if (input.category !== undefined) {
    if (input.category !== null && !isVideoCategory(input.category)) return new AppError("Nieznana kategoria filmu.", 400, "VIDEO_CATEGORY_INVALID");
    out.category = input.category;
  }
  if (input.commentsMode !== undefined) {
    if (!isVideoCommentsMode(input.commentsMode)) return new AppError("Nieznany tryb komentarzy.", 400, "VIDEO_COMMENTS_MODE_INVALID");
    out.commentsMode = input.commentsMode;
  }
  if (input.chapters !== undefined) {
    const chapters = input.chapters === null ? [] : normalizeChapters(input.chapters);
    const problem = validateChapters(chapters, context.durationSeconds)[0];
    if (problem) {
      const where = problem.index === undefined ? "" : ` (rozdział ${problem.index + 1})`;
      return new AppError(`${CHAPTER_MESSAGES[problem.code]}${where}`, 400, "VIDEO_CHAPTERS_INVALID");
    }
    out.chapters = chapters.length > 0 ? chapters : null;
  }
  return out;
}
