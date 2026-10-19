import { buildEmbedPath } from "./paths";

/** Size of the embedded player when the consumer names no limit (16:9). */
export const EMBED_DEFAULT_WIDTH = 640;
/** Largest player an embed code or an oEmbed answer ever asks for. */
export const EMBED_MAX_WIDTH = 1920;

export type EmbedSize = { width: number; height: number };

/** A `maxwidth`/`maxheight` query value: a positive whole number (digits only), otherwise ignored. */
export function parseEmbedDimension(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw > 0 && raw <= 100_000 ? raw : null;
  if (typeof raw !== "string" || !/^\d{1,6}$/.test(raw)) return null;
  const value = Number(raw);
  return value > 0 ? value : null;
}

/**
 * The player size for an embed code or an oEmbed answer: 16:9, never larger than `maxWidth`/`maxHeight`
 * (oEmbed 1.0 "maxwidth"/"maxheight"), never larger than EMBED_MAX_WIDTH. The height limit wins by shrinking the width.
 */
export function computeEmbedSize({ maxWidth, maxHeight }: { maxWidth?: number | null; maxHeight?: number | null } = {}): EmbedSize {
  let width = Math.min(maxWidth && maxWidth > 0 ? Math.floor(maxWidth) : EMBED_DEFAULT_WIDTH, EMBED_MAX_WIDTH);
  width = Math.max(1, width);
  let height = Math.max(1, Math.round((width * 9) / 16));
  if (maxHeight && maxHeight > 0 && height > Math.floor(maxHeight)) {
    height = Math.max(1, Math.floor(maxHeight));
    width = Math.max(1, Math.floor((height * 16) / 9));
  }
  return { width, height };
}

/** Escapes a value for a double-quoted HTML attribute. */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type EmbedSnippetInput = {
  /** Canonical site origin, e.g. https://www.pawelperfect.com (no trailing slash needed). */
  baseUrl: string;
  /** The video's slug (globally unique). */
  slug: string;
  title: string;
  width?: number;
  height?: number;
  /** Interface language of the player (pl, en, de, ...); omitted = negotiated from the visitor's browser. */
  lang?: string | null;
};

/** The embeddable player's address (absolute). */
export function buildEmbedUrl(baseUrl: string, slug: string, lang?: string | null): string {
  return `${baseUrl.replace(/\/+$/, "")}${buildEmbedPath(slug, lang)}`;
}

/**
 * The `<iframe>` code to paste into another site ("Share -> Embed" and the oEmbed `html` field). Pure: every
 * dynamic value is attribute-escaped. Only PUBLIC-tier videos are meant to be offered (the embed page itself
 * refuses everything else).
 */
export function buildEmbedSnippet({ baseUrl, slug, title, width, height, lang }: EmbedSnippetInput): string {
  const size = width && height ? { width, height } : computeEmbedSize({ maxWidth: width ?? null, maxHeight: height ?? null });
  const src = escapeHtmlAttribute(buildEmbedUrl(baseUrl, slug, lang));
  return (
    `<iframe src="${src}" width="${size.width}" height="${size.height}" title="${escapeHtmlAttribute(title)}" ` +
    `frameborder="0" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy" ` +
    `referrerpolicy="strict-origin-when-cross-origin"></iframe>`
  );
}
