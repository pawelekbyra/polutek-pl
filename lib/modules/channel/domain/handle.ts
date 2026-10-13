/**
 * Channel handle (@name) and channel display name rules (docs/audit/2026-10-13/ux-studio-tworcy.md, section 2).
 * Pure functions, no I/O: uniqueness and history are checked by the use cases.
 */

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;
export const CHANNEL_NAME_MAX_LENGTH = 50;

/** Names that would collide with routes, impersonate the platform or its staff, or confuse. Lowercase. */
const RESERVED_ROUTES = [
  "admin", "api", "studio", "www", "app", "auth", "login", "logout", "signin", "signup", "register", "settings",
  "account", "upload", "watch", "embed", "search", "feed", "subscriptions", "explore", "trending", "channel", "channels",
  "c", "u", "v", "about", "help", "support", "terms", "privacy", "legal", "dmca", "report", "payouts", "wyplaty",
  "stripe", "status", "blog", "docs", "static", "assets", "cdn", "hls", "media", "video", "videos", "home", "index",
  "robots", "sitemap", "manifest", "favicon", "health", "cron", "webhooks", "unsubscribe", "reset-password", "sso-callback",
  "regulamin", "polityka-prywatnosci", "privacy-policy", "search", "new", "edit", "delete", "me", "my", "null", "undefined",
];
const RESERVED_ROLES = [
  "official", "oficjalny", "oficjalna", "team", "staff", "moderator", "moderators", "mod", "mods", "system", "root",
  "administrator", "admins", "owner", "security", "abuse", "postmaster", "noreply", "no-reply", "info", "contact", "kontakt",
  "billing", "payments", "platform", "verified", "partner",
];
/** Other languages of the interface (CLAUDE.md 4.11): the words for help, settings, account. */
const RESERVED_TRANSLATED = [
  "pomoc", "ustawienia", "konto", "hilfe", "einstellungen", "konto-de", "ayuda", "ajustes", "cuenta", "aide", "parametres",
  "compte", "aiuto", "impostazioni", "ajuda", "configuracoes", "conta", "bangzhu", "shezhi", "zhanghu",
];
/** The platform's own name and its variants: only staff may hold them. */
const BRAND = ["pawelperfect", "pawel-perfect", "pawel_perfect", "perfect", "polutek"];

export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  ...RESERVED_ROUTES,
  ...RESERVED_ROLES,
  ...RESERVED_TRANSLATED,
  ...BRAND,
]);

export type HandleProblem =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_CHARACTERS"
  | "EDGE_SEPARATOR"
  | "CONSECUTIVE_SEPARATORS"
  | "NOT_A_NAME"
  | "LOOKS_LIKE_ADDRESS"
  | "RESERVED";

export type HandleCheck = { ok: true; handle: string } | { ok: false; problem: HandleProblem; message: string };

const MESSAGES: Record<HandleProblem, string> = {
  TOO_SHORT: `Uchwyt ma co najmniej ${HANDLE_MIN_LENGTH} znaki.`,
  TOO_LONG: `Uchwyt ma najwyżej ${HANDLE_MAX_LENGTH} znaków.`,
  INVALID_CHARACTERS: "Uchwyt może zawierać tylko małe litery a-z, cyfry oraz znaki . _ -",
  EDGE_SEPARATOR: "Uchwyt musi zaczynać się i kończyć literą lub cyfrą.",
  CONSECUTIVE_SEPARATORS: "Uchwyt nie może mieć dwóch znaków specjalnych obok siebie.",
  NOT_A_NAME: "Uchwyt nie może składać się z samych cyfr i znaków specjalnych.",
  LOOKS_LIKE_ADDRESS: "Uchwyt nie może wyglądać jak adres strony ani adres e-mail.",
  RESERVED: "Ten uchwyt jest zarezerwowany.",
};

const DOMAIN_SUFFIX = /\.(com|net|org|pl|eu|io|tv|me|co|info|xyz|app|dev|de|uk|fr|es|it)$/;

/** Lowercases, trims and drops one leading "@". Does not transliterate (see `suggestHandleBase`). */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

export function validateHandle(input: string): HandleCheck {
  const handle = normalizeHandle(input);
  const fail = (problem: HandleProblem): HandleCheck => ({ ok: false, problem, message: MESSAGES[problem] });

  if (handle.length < HANDLE_MIN_LENGTH) return fail("TOO_SHORT");
  if (handle.length > HANDLE_MAX_LENGTH) return fail("TOO_LONG");
  if (!/^[a-z0-9._-]+$/.test(handle)) return fail("INVALID_CHARACTERS");
  if (!/^[a-z0-9]/.test(handle) || !/[a-z0-9]$/.test(handle)) return fail("EDGE_SEPARATOR");
  if (/[._-]{2,}/.test(handle)) return fail("CONSECUTIVE_SEPARATORS");
  if (/^[0-9._-]+$/.test(handle)) return fail("NOT_A_NAME");
  if (DOMAIN_SUFFIX.test(handle) || handle.startsWith("www.") || handle.includes("http")) return fail("LOOKS_LIKE_ADDRESS");
  if (RESERVED_HANDLES.has(handle)) return fail("RESERVED");
  return { ok: true, handle };
}

const TRANSLITERATION: Record<string, string> = {
  ł: "l", ą: "a", ć: "c", ę: "e", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z", ß: "ss", æ: "ae", ø: "o", đ: "d", ð: "d", þ: "th",
};

/** A readable base for handle suggestions from a display name: ASCII, lowercase, separated by "-". */
export function suggestHandleBase(name: string): string {
  const lower = name.trim().toLowerCase();
  const mapped = [...lower].map((ch) => TRANSLITERATION[ch] ?? ch).join("");
  const ascii = mapped.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const base = ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, HANDLE_MAX_LENGTH).replace(/-+$/g, "");
  return base;
}

/** Candidate handles derived from a base, valid by `validateHandle`; the caller filters by availability. */
export function handleCandidates(base: string, count = 6): string[] {
  const root = suggestHandleBase(base);
  const out: string[] = [];
  const push = (value: string) => {
    const check = validateHandle(value);
    if (check.ok && !out.includes(check.handle)) out.push(check.handle);
  };
  push(root);
  push(`${root}-tv`);
  push(`${root}.pl`.replace(/\.pl$/, "-pl"));
  push(`${root}-channel`);
  for (let i = 2; out.length < count && i < 100; i++) push(`${root.slice(0, HANDLE_MAX_LENGTH - String(i).length - 1)}-${i}`);
  return out.slice(0, count);
}

export type NameProblem = "EMPTY" | "TOO_LONG" | "INVALID_CHARACTERS" | "RESERVED_BRAND";
export type NameCheck = { ok: true; name: string } | { ok: false; problem: NameProblem; message: string };

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
/** Zero-width, directional-override and other invisible characters used for spoofing. */
const INVISIBLE_CHARACTERS = /[​-‏‪-‮⁠-⁤﻿]/;
const BRAND_IN_NAME = /(pawe[lł][\s._-]*perfect|polutek)/i;

/** Display name: trimmed, inner whitespace collapsed, 1..50 characters, no control or invisible characters. */
export function validateChannelName(input: string, options: { allowBrand?: boolean } = {}): NameCheck {
  const name = input.replace(/\s+/g, " ").trim();
  if (CONTROL_CHARACTERS.test(name) || INVISIBLE_CHARACTERS.test(name)) {
    return { ok: false, problem: "INVALID_CHARACTERS", message: "Nazwa zawiera niedozwolone znaki." };
  }
  if (name.length === 0) return { ok: false, problem: "EMPTY", message: "Podaj nazwę kanału." };
  if ([...name].length > CHANNEL_NAME_MAX_LENGTH) {
    return { ok: false, problem: "TOO_LONG", message: `Nazwa kanału ma najwyżej ${CHANNEL_NAME_MAX_LENGTH} znaków.` };
  }
  if (!options.allowBrand && BRAND_IN_NAME.test(name)) {
    return { ok: false, problem: "RESERVED_BRAND", message: "Ta nazwa jest zarezerwowana dla platformy." };
  }
  return { ok: true, name };
}
