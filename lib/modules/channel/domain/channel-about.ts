import { resolveChannelBannerUrl } from "./channel-banner-limits";

/**
 * "About" section rules of a channel page (pure): external links and the optional public contact e-mail.
 * Links are https only, never carry credentials, point at a real host (no localhost / private addresses) and are
 * rendered with rel="noopener nofollow ugc".
 */
export const CHANNEL_LINKS_MAX = 5;
export const CHANNEL_LINK_TITLE_MAX = 40;
export const CHANNEL_LINK_URL_MAX = 300;
export const CHANNEL_CONTACT_EMAIL_MAX = 120;

export interface ChannelLink {
  title: string;
  url: string;
}

export type ChannelAboutProblem =
  | "TOO_MANY_LINKS"
  | "LINK_TITLE"
  | "LINK_URL"
  | "LINK_NOT_HTTPS"
  | "LINK_HOST"
  | "LINK_DUPLICATE"
  | "EMAIL";

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Normalizes one URL; returns a problem code instead of throwing. */
export function normalizeChannelLinkUrl(raw: string): { ok: true; url: string } | { ok: false; problem: ChannelAboutProblem } {
  const text = raw.trim();
  if (!text || text.length > CHANNEL_LINK_URL_MAX || /[\s\u0000-\u001f]/.test(text)) return { ok: false, problem: "LINK_URL" };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, problem: "LINK_URL" };
  }
  if (url.protocol !== "https:") return { ok: false, problem: "LINK_NOT_HTTPS" };
  if (url.username || url.password) return { ok: false, problem: "LINK_URL" };
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.startsWith("[") || PRIVATE_HOST.test(host) || isPrivateIpv4(host) || /^[\d.]+$/.test(host)) {
    return { ok: false, problem: "LINK_HOST" };
  }
  return { ok: true, url: url.toString() };
}

/** Validates and normalizes the whole list (trims titles, drops empty rows, rejects duplicates). */
export function normalizeChannelLinks(
  input: ReadonlyArray<{ title: unknown; url: unknown }>,
): { ok: true; links: ChannelLink[] } | { ok: false; problem: ChannelAboutProblem } {
  const rows = input.filter((row) => String(row.title ?? "").trim() !== "" || String(row.url ?? "").trim() !== "");
  if (rows.length > CHANNEL_LINKS_MAX) return { ok: false, problem: "TOO_MANY_LINKS" };
  const links: ChannelLink[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const title = typeof row.title === "string" ? row.title.trim().replace(/\s+/g, " ") : "";
    if (!title || [...title].length > CHANNEL_LINK_TITLE_MAX) return { ok: false, problem: "LINK_TITLE" };
    const url = normalizeChannelLinkUrl(typeof row.url === "string" ? row.url : "");
    if (!url.ok) return { ok: false, problem: url.problem };
    if (seen.has(url.url)) return { ok: false, problem: "LINK_DUPLICATE" };
    seen.add(url.url);
    links.push({ title, url: url.url });
  }
  return { ok: true, links };
}

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** Empty = no public contact e-mail (null). */
export function normalizeContactEmail(raw: string | null | undefined): { ok: true; email: string | null } | { ok: false; problem: ChannelAboutProblem } {
  const text = (raw ?? "").trim();
  if (!text) return { ok: true, email: null };
  if (text.length > CHANNEL_CONTACT_EMAIL_MAX || !EMAIL_PATTERN.test(text)) return { ok: false, problem: "EMAIL" };
  return { ok: true, email: text };
}

/** Reads the stored JSON back into a safe list (anything malformed is dropped). */
export function parseStoredChannelLinks(value: unknown): ChannelLink[] {
  if (!Array.isArray(value)) return [];
  const out: ChannelLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { title, url } = item as { title?: unknown; url?: unknown };
    if (typeof title !== "string" || typeof url !== "string") continue;
    const normalized = normalizeChannelLinkUrl(url);
    if (normalized.ok && title.trim()) out.push({ title: title.trim().slice(0, CHANNEL_LINK_TITLE_MAX), url: normalized.url });
    if (out.length >= CHANNEL_LINKS_MAX) break;
  }
  return out;
}

export const CHANNEL_ABOUT_MESSAGES: Record<ChannelAboutProblem, string> = {
  TOO_MANY_LINKS: `Możesz dodać najwyżej ${CHANNEL_LINKS_MAX} linków.`,
  LINK_TITLE: `Każdy link potrzebuje nazwy (najwyżej ${CHANNEL_LINK_TITLE_MAX} znaków).`,
  LINK_URL: "Adres linku jest niepoprawny.",
  LINK_NOT_HTTPS: "Linki muszą zaczynać się od https://.",
  LINK_HOST: "Ten adres linku nie jest dozwolony.",
  LINK_DUPLICATE: "Ten sam link jest dodany dwa razy.",
  EMAIL: "Adres e-mail do kontaktu jest niepoprawny.",
};

/** The only About/banner fields that reach the public channel page DTO (an allowlist, never a spread of the row). */
export interface PublicChannelAbout {
  bannerImageUrl: string | null;
  links: ChannelLink[];
  /** Present only when the creator typed a public contact e-mail. */
  contactEmail: string | null;
  /** ISO time the channel was created. */
  joinedAt: string;
  totalViews: number;
}

export function toPublicChannelAbout(
  row: {
    id: string;
    createdAt?: Date | null;
    links?: unknown;
    publicContactEmail?: string | null;
    bannerUpdatedAt?: Date | null;
  },
  videos: ReadonlyArray<{ views?: number | null }>,
): PublicChannelAbout {
  return {
    bannerImageUrl: resolveChannelBannerUrl(row),
    links: parseStoredChannelLinks(row.links),
    contactEmail: row.publicContactEmail || null,
    joinedAt: row.createdAt ? row.createdAt.toISOString() : "",
    totalViews: videos.reduce((sum, v) => sum + (v.views ?? 0), 0),
  };
}
