/**
 * Pure rules of the Studio video forms (no React, no I/O): field limits, the mapping of the visibility choice to
 * API fields, the list query string and dirty-state detection. Kept separate so they are unit-tested.
 * The limits mirror `lib/api/studio-schemas.ts`; the server stays the authority.
 */

import { VIDEO_TAG_MAX_LENGTH, VIDEO_TAGS_MAX, normalizeTag, type VideoCommentsModeValue } from "@/lib/video-metadata";

export { VIDEO_TAG_MAX_LENGTH as TAG_MAX_LENGTH, VIDEO_TAGS_MAX as TAGS_MAX };
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 5000;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** What a creator can choose in step 2 of the wizard. */
export type VisibilityMode = "private" | "auto" | "scheduled";

export interface VisibilityFields {
  publishAfterAssetReady: boolean;
  premiereAt: string | null;
}

export type VisibilityResult =
  | { ok: true; fields: VisibilityFields }
  | { ok: false; reason: "PREMIERE_REQUIRED" | "PREMIERE_INVALID" | "PREMIERE_PAST" };

/**
 * Maps the visibility choice to the fields of `POST /api/studio/videos`.
 * - private: a plain draft, nothing is published on its own;
 * - auto: publish when processing finishes;
 * - scheduled: publish when processing finishes and wait for `premiereAt` (a "coming soon" premiere).
 * `premiereLocal` is the value of a `datetime-local` input (browser local time).
 */
export function visibilityToFields(mode: VisibilityMode, premiereLocal: string, now: Date): VisibilityResult {
  if (mode === "private") return { ok: true, fields: { publishAfterAssetReady: false, premiereAt: null } };
  if (mode === "auto") return { ok: true, fields: { publishAfterAssetReady: true, premiereAt: null } };
  if (!premiereLocal) return { ok: false, reason: "PREMIERE_REQUIRED" };
  const at = new Date(premiereLocal);
  if (Number.isNaN(at.getTime())) return { ok: false, reason: "PREMIERE_INVALID" };
  if (at.getTime() <= now.getTime()) return { ok: false, reason: "PREMIERE_PAST" };
  return { ok: true, fields: { publishAfterAssetReady: true, premiereAt: at.toISOString() } };
}

/** First title suggestion taken from the file name. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, TITLE_MAX);
}

/** `null` when the file may be uploaded as a thumbnail; otherwise why not. */
export function validateCoverFile(file: { type: string; size: number }): "TYPE" | "SIZE" | null {
  if (!(COVER_TYPES as readonly string[]).includes(file.type)) return "TYPE";
  if (file.size > COVER_MAX_BYTES) return "SIZE";
  return null;
}

export type StatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type SortKey = "newest" | "views";

export interface ListQuery {
  q: string;
  status: StatusFilter;
  sort: SortKey;
  page: number;
  limit: number;
}

/** Query string of `GET /api/studio/videos`; defaults are left out. */
export function buildVideoListQuery(query: ListQuery): string {
  const params = new URLSearchParams();
  const q = query.q.trim();
  if (q) params.set("q", q.slice(0, 100));
  if (query.status !== "ALL") params.set("status", query.status);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  params.set("limit", String(query.limit));
  return params.toString();
}

export interface EditorForm {
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  tier: "PUBLIC" | "LOGGED_IN";
  premiere: string;
  tags: string[];
  /** A key of `VIDEO_CATEGORIES` or "" for none. */
  category: string;
  commentsMode: VideoCommentsModeValue;
}

/** True when anything the creator can type differs from the saved baseline. */
export function isFormDirty(form: EditorForm, baseline: EditorForm | null): boolean {
  if (!baseline) return false;
  return (Object.keys(baseline) as (keyof EditorForm)[]).some((key) => {
    const a = form[key];
    const b = baseline[key];
    if (Array.isArray(a) && Array.isArray(b)) return a.length !== b.length || a.some((item, index) => item !== b[index]);
    return a !== b;
  });
}

export type TagInputProblem = "TOO_MANY" | "TOO_LONG";

export interface TagInputResult {
  tags: string[];
  /** What could not be added (kept in the input so nothing the creator typed is lost). */
  leftover: string;
  problem: TagInputProblem | null;
}

/**
 * Adds what was typed or pasted to the tag list. Tags are separated by a comma or a new line (Enter commits the
 * whole input); each one is trimmed, loses a leading `#` and is skipped when it is a duplicate (case-insensitive).
 * A tag over the length limit or beyond the count limit is not added: it stays in `leftover` with the reason.
 * Counts characters, not UTF-16 units, so an emoji is one character like on the server.
 */
export function addTagsFromInput(current: readonly string[], text: string): TagInputResult {
  const tags = [...current];
  const known = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
  const leftover: string[] = [];
  let problem: TagInputProblem | null = null;
  for (const part of text.split(/[,\n]/)) {
    const tag = normalizeTag(part);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (known.has(key)) continue;
    if ([...tag].length > VIDEO_TAG_MAX_LENGTH) {
      problem = problem ?? "TOO_LONG";
      leftover.push(tag);
      continue;
    }
    if (tags.length >= VIDEO_TAGS_MAX) {
      problem = "TOO_MANY";
      leftover.push(tag);
      continue;
    }
    tags.push(tag);
    known.add(key);
  }
  return { tags, leftover: leftover.join(", "), problem };
}

export function removeTag(tags: readonly string[], index: number): string[] {
  return tags.filter((_, i) => i !== index);
}

/** `used/max` text of the tag counter. */
export function tagCounterText(tags: readonly string[]): string {
  return `${tags.length}/${VIDEO_TAGS_MAX}`;
}

/** `YYYY-MM-DDTHH:mm` in local time for a `datetime-local` input. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
