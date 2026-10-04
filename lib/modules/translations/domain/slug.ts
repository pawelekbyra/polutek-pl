/**
 * Address of a film in one language, made deterministically from its translated title (no AI):
 * transliteration to ASCII, dashes, at most 80 characters, and `-2`, `-3`, ... when the address is taken
 * in that language. Pure: the caller says which addresses are taken.
 */
export const SLUG_MAX = 80;

const COMMON: Record<string, string> = {
  ł: "l", Ł: "L", ß: "ss", æ: "ae", Æ: "AE", ø: "o", Ø: "O", œ: "oe", Œ: "OE", đ: "d", Đ: "D", þ: "th", Þ: "TH", ð: "d", ı: "i",
  "&": " and ",
};
/** German writes umlauts as ae/oe/ue when the dots are dropped (München -> muenchen). */
const GERMAN: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue" };
const AND: Record<string, string> = { pl: " i ", de: " und ", es: " y ", fr: " et ", it: " e ", pt: " e " };

export function transliterate(text: string, language: string): string {
  let out = "";
  for (const ch of text) {
    if (language === "de" && GERMAN[ch]) out += GERMAN[ch];
    else if (ch === "&") out += AND[language] ?? COMMON["&"];
    else out += COMMON[ch] ?? ch;
  }
  return out.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** "Behind the Scenes: Part 2!" -> "behind-the-scenes-part-2"; "" when nothing Latin is left (e.g. Chinese). */
export function slugBase(title: string, language: string): string {
  return transliterate(title, language)
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/**
 * The first free address: `base`, then `base-2`, `base-3`, ... (the suffix always fits in 80 characters).
 * `fallback` (normally the film's original address) is used when the title has no Latin letters.
 */
export function uniqueSlug(title: string, language: string, isTaken: (slug: string) => boolean, fallback: string): string {
  const base = slugBase(title, language) || slugBase(fallback, "pl") || "film";
  if (!isTaken(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error("No free address left for this title.");
}

/** A typed address is accepted only in its final form (lower-case a-z, 0-9, single dashes). */
export const isValidSlug = (slug: string) => slug.length > 0 && slug.length <= SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
