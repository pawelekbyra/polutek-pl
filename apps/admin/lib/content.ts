/**
 * Data of the "Treści" screens: real module reads in production; labelled sample data under `next dev`
 * with ADMIN_DEV_FIXTURES=1 (writes are then refused, see actions). Plus the shared words and states the
 * list, the film page and the edit form use, so a state reads the same everywhere.
 */
import {
  getChannelLayout,
  getContentDetail,
  listContent,
  type ContentDetail,
  type ContentFilters,
  type ContentListResult,
  type LayoutItem,
} from "@/lib/modules/admin-content";
import { isUpcomingPremiere, type AdminVideoDto } from "@/lib/modules/video";
import type { PipelineStateDto } from "@/lib/modules/video-pipeline";
import { createAppContext } from "@/lib/modules/shared/app-context";
import type { StateKind } from "@/lib/modules/admin-overview";
import { listFilmTranslations, type FilmTranslationsDto } from "@/lib/modules/translations";
import { isDevFixturesEnabled } from "./config";
import { fixtureDetail, fixtureLayout, fixtureList, fixtureTranslations } from "./content-fixtures";

const readCtx = () => createAppContext({ type: "system", reason: "admin_panel_read" });

export async function loadContentList(filters: ContentFilters): Promise<ContentListResult> {
  if (isDevFixturesEnabled()) return fixtureList(filters);
  const res = await listContent(filters, readCtx());
  if (!res.ok) throw res.error;
  return res.data;
}

export async function loadContentDetail(slug: string): Promise<ContentDetail | null> {
  if (isDevFixturesEnabled()) return fixtureDetail(slug);
  const res = await getContentDetail(slug, readCtx());
  return res.ok ? res.data : null;
}

export async function loadFilmTranslations(slug: string): Promise<FilmTranslationsDto | null> {
  if (isDevFixturesEnabled()) return fixtureTranslations(slug);
  const res = await listFilmTranslations(slug, readCtx());
  return res.ok ? res.data : null;
}

export async function loadChannelLayout(): Promise<LayoutItem[]> {
  if (isDevFixturesEnabled()) return fixtureLayout();
  return getChannelLayout(readCtx());
}

// ---------------------------------------------------------------- words and states

export const TIER_LABEL: Record<string, string> = { PUBLIC: "Publiczny", LOGGED_IN: "Po zalogowaniu", PATRON: "Po zalogowaniu (dawny Patron)" };

export function statusOf(v: Pick<AdminVideoDto, "status" | "premiereAt">, now: Date): { kind: StateKind | ""; label: string; icon?: "calendar" | "archive" | "note" } {
  if (isUpcomingPremiere(v, now)) return { kind: "info", label: "Premiera", icon: "calendar" };
  if (v.status === "PUBLISHED") return { kind: "ok", label: "Opublikowany" };
  if (v.status === "ARCHIVED") return { kind: "", label: "Archiwum", icon: "archive" };
  return { kind: "", label: "Szkic", icon: "note" };
}

/** State of the own HLS source from the list DTO (migrationStatus) or, on the film page, from the pipeline. */
export function hlsOf(v: Pick<AdminVideoDto, "migrationStatus">, pipeline?: PipelineStateDto | null): { kind: StateKind | "muted"; label: string } {
  if (pipeline) {
    const s = pipeline.summary;
    if (s === "ENCODING") return { kind: "info", label: `Kodowanie ${pipeline.job?.progressPercent ?? 0}%` };
    if (s === "QUEUED") return { kind: "info", label: "W kolejce" };
    if (s === "UPLOADING") return { kind: "info", label: "Wgrywanie oryginału" };
    if (s === "FAILED" || s === "UPLOAD_FAILED") return { kind: "crit", label: s === "FAILED" ? "Błąd kodowania" : "Błąd wgrywania" };
    if (s === "CANCELLED") return { kind: "warn", label: "Kodowanie anulowane" };
    if (s === "NO_ORIGINAL") return { kind: "muted", label: "Brak oryginału" };
  }
  switch (v.migrationStatus) {
    case "READY":
      return { kind: "ok", label: "Gotowe" };
    case "PROCESSING":
      return { kind: "info", label: "Kodowanie" };
    case "FAILED":
      return { kind: "crit", label: "Błąd" };
    case "MIGRATION_REQUIRED":
      return { kind: "warn", label: "Stare źródło: wgraj ponownie" };
    default:
      return { kind: "muted", label: "Brak oryginału" };
  }
}

/** Thumbnail src for the panel: always the panel's own preview route (drafts included, CSP 'self'). */
export const thumbSrc = (v: Pick<AdminVideoDto, "id" | "updatedAt">) => `/api/videos/${encodeURIComponent(v.id)}/thumbnail?v=${new Date(v.updatedAt).getTime()}`;

export const publicBase = () => (process.env.NEXT_PUBLIC_APP_URL || "https://www.pawelperfect.com").replace(/\/+$/, "");

/** Where the viewer sees the film (the www home page takes ?v=<slug>). */
export const publicFilmUrl = (slug: string) => `${publicBase()}/pl?v=${encodeURIComponent(slug)}`;

/** Diagnostics come from the old panel's use case; a few phrases point at its tabs or show raw enum values. */
export function diagnosticText(message: string): string {
  return message
    .replace(/w zakładce Media/g, "w edycji filmu")
    .replace("Materiał jest w stanie: PROCESSING.", "Wideo jeszcze się koduje.")
    .replace("Materiał jest w stanie: PENDING.", "Wideo czeka na kodowanie.")
    .replace(/Materiał jest w stanie: ([A-Z_]+)\./,"Stan wideo: $1.");
}
