/**
 * How the public site must treat a translation once per-language pages exist (designed now, used later):
 * a machine draft is labelled "tłumaczenie automatyczne", is `noindex` and stays out of the sitemap until a
 * person approves it. Approved and edited versions are ordinary pages.
 */
export type TranslationStatus = "AI_DRAFT" | "APPROVED" | "EDITED";

export type TranslationPublicMeta = { autoTranslatedLabel: boolean; noindex: boolean; inSitemap: boolean };

export function translationPublicMeta(status: TranslationStatus): TranslationPublicMeta {
  const draft = status === "AI_DRAFT";
  return { autoTranslatedLabel: draft, noindex: draft, inSitemap: !draft };
}

export const STATUS_LABEL: Record<TranslationStatus, string> = {
  AI_DRAFT: "Szkic automatyczny",
  APPROVED: "Zatwierdzone",
  EDITED: "Napisane przez człowieka",
};

type Original = { title: string; description?: string | null; titleEn?: string | null; descriptionEn?: string | null; subtitleUrlPl?: string | null; subtitleUrlEn?: string | null };
type Row = { language: string; title: string; description: string | null; subtitleUrl: string | null; status: TranslationStatus };

/**
 * Text of a film in one language with compatibility for the columns that exist today: a translation row
 * wins; for "en" the old Video.titleEn/descriptionEn/subtitleUrlEn still count; otherwise the original.
 * `fallback` tells the page to show the original-language note.
 */
export function resolveFilmText(video: Original, rows: Row[], language: string): { title: string; description: string | null; subtitleUrl: string | null; status: TranslationStatus | "ORIGINAL"; fallback: boolean } {
  if (language === "pl") return { title: video.title, description: video.description ?? null, subtitleUrl: video.subtitleUrlPl ?? null, status: "ORIGINAL", fallback: false };
  const row = rows.find((r) => r.language === language);
  if (row) return { title: row.title, description: row.description, subtitleUrl: row.subtitleUrl ?? (language === "en" ? video.subtitleUrlEn ?? null : null), status: row.status, fallback: false };
  if (language === "en" && video.titleEn) return { title: video.titleEn, description: video.descriptionEn ?? null, subtitleUrl: video.subtitleUrlEn ?? null, status: "EDITED", fallback: false };
  return { title: video.title, description: video.description ?? null, subtitleUrl: null, status: "ORIGINAL", fallback: true };
}
