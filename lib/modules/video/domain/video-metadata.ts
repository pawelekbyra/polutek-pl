import { AppError } from "@/lib/modules/shared/app-error";
import { isVideoCategory, isVideoCommentsMode, normalizeTags, validateTags, VIDEO_TAG_MAX_LENGTH, VIDEO_TAGS_MAX, type VideoCommentsModeValue } from "@/lib/video-metadata";

export interface VideoMetadataInput {
  tags?: string[];
  category?: string | null;
  commentsMode?: string;
}

export interface VideoMetadataFields {
  tags?: string[];
  category?: string | null;
  commentsMode?: VideoCommentsModeValue;
}

/**
 * The creator metadata of a create/update, validated against the whitelists of `lib/video-metadata.ts`
 * (the route's zod schema is the first line; this keeps every other caller of the use cases honest).
 * Only fields that were sent come back, so an update never clears what it did not mention.
 */
export function resolveVideoMetadata(input: VideoMetadataInput): VideoMetadataFields | AppError {
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
  return out;
}
