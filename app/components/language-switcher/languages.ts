import type { Locale } from "@/lib/i18n/routing";

export type LanguageOption = {
  /** Short code shown in the pill and next to the name. */
  code: string;
  /** The language's own name for itself (endonym). */
  label: string;
  /** BCP 47 tag of `label`, so screen readers pronounce it in that language. */
  lang: string;
  /** File in public/flags/ (circle-flags, MIT, see docs/operations/THIRD_PARTY_NOTICES.md). */
  flag: string;
  /** Locale the site can really switch to today; null = listed, but no translation yet. */
  locale: Locale | null;
};

// Only PL and EN are real locales. The other languages are listed so the switcher looks complete
// (owner decision, #1599): picking one shows its flag and code in the pill and a short
// "translation in progress" note, and the site stays in the current language. To make one real,
// add it to lib/i18n/routing.ts, translate the UI/e-mails/legal documents, then set its `locale`.
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "PL", label: "Polski", lang: "pl", flag: "pl", locale: "pl" },
  { code: "EN", label: "English", lang: "en", flag: "gb", locale: "en" },
  { code: "DE", label: "Deutsch", lang: "de", flag: "de", locale: null },
  { code: "ES", label: "Español", lang: "es", flag: "es", locale: null },
  { code: "FR", label: "Français", lang: "fr", flag: "fr", locale: null },
  { code: "IT", label: "Italiano", lang: "it", flag: "it", locale: null },
  { code: "PT", label: "Português", lang: "pt", flag: "pt", locale: null },
  { code: "ZH", label: "中文", lang: "zh", flag: "cn", locale: null },
];

/** Same-origin path of an option's flag; nothing is ever loaded from another host. */
export function flagSrc(option: LanguageOption): string {
  return `/flags/${option.flag}.svg`;
}

/** Type-ahead match: the name or the code starts with the typed letters (case-insensitive). */
export function startsWithTyped(option: LanguageOption, typed: string): boolean {
  const prefix = typed.toLowerCase();
  return option.label.toLowerCase().startsWith(prefix) || option.code.toLowerCase().startsWith(prefix);
}

let flagsWarmed = false;

/**
 * Starts loading every flag (about 6 kB in total) when the pointer or focus reaches the pill, so
 * the list opens with its flags already decoded. Nothing is loaded before that.
 */
export function warmFlags(): void {
  if (flagsWarmed || typeof window === "undefined" || typeof Image === "undefined") return;
  flagsWarmed = true;
  for (const option of LANGUAGE_OPTIONS) {
    const img = new Image();
    img.decoding = "async";
    img.src = flagSrc(option);
  }
}
