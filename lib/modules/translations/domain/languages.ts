/**
 * Languages a film can be translated into. The original is always Polish (the Video row itself). Same set
 * and flags as the site's language switcher (app/components/language-switcher/languages.ts); only PL and
 * EN are real site locales today, the others get translations ahead of their UI.
 */
export const ORIGINAL_LANGUAGE = "pl" as const;

export type TranslationLanguage = { code: string; label: string; namePl: string; flag: string };

export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { code: "en", label: "English", namePl: "angielski", flag: "gb" },
  { code: "de", label: "Deutsch", namePl: "niemiecki", flag: "de" },
  { code: "es", label: "Español", namePl: "hiszpański", flag: "es" },
  { code: "fr", label: "Français", namePl: "francuski", flag: "fr" },
  { code: "it", label: "Italiano", namePl: "włoski", flag: "it" },
  { code: "pt", label: "Português", namePl: "portugalski", flag: "pt" },
  { code: "zh", label: "中文", namePl: "chiński", flag: "cn" },
];

export const isTranslationLanguage = (code: string): boolean => TRANSLATION_LANGUAGES.some((l) => l.code === code);

/** pl (original) or a translation language: what subtitle uploads accept. */
export const isSubtitleLanguage = (code: string): boolean => code === ORIGINAL_LANGUAGE || isTranslationLanguage(code);
