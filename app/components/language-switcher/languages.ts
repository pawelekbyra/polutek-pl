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
  /** The site language this row switches to. */
  locale: Locale;
};

// All eight languages are real: the interface is translated into each (docs/operations/I18N.md).
// Page content (film texts, legal documents, e-mails) exists in Polish and English only; the other
// languages show English there.
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "PL", label: "Polski", lang: "pl", flag: "pl", locale: "pl" },
  { code: "EN", label: "English", lang: "en", flag: "gb", locale: "en" },
  { code: "DE", label: "Deutsch", lang: "de", flag: "de", locale: "de" },
  { code: "ES", label: "Español", lang: "es", flag: "es", locale: "es" },
  { code: "FR", label: "Français", lang: "fr", flag: "fr", locale: "fr" },
  { code: "IT", label: "Italiano", lang: "it", flag: "it", locale: "it" },
  { code: "PT", label: "Português", lang: "pt", flag: "pt", locale: "pt" },
  { code: "ZH", label: "中文", lang: "zh-CN", flag: "cn", locale: "zh" },
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
