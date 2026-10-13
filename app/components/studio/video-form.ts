/**
 * Pure rules of the Studio video forms (no React, no I/O): field limits, the mapping of the visibility choice to
 * API fields, the list query string and dirty-state detection. Kept separate so they are unit-tested.
 * The limits mirror `lib/api/studio-schemas.ts`; the server stays the authority.
 */

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
}

/** True when anything the creator can type differs from the saved baseline. */
export function isFormDirty(form: EditorForm, baseline: EditorForm | null): boolean {
  if (!baseline) return false;
  return (Object.keys(baseline) as (keyof EditorForm)[]).some((key) => form[key] !== baseline[key]);
}

/** `YYYY-MM-DDTHH:mm` in local time for a `datetime-local` input. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
