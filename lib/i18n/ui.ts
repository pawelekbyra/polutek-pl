import type { Locale } from "@/lib/i18n/routing";

/**
 * Interface strings of the public site. Components write both source texts inline, next to the
 * markup they belong to: `tx("Zaloguj się", "Sign in")`. Polish and English come from those two
 * arguments. Every other language comes from a catalog (lib/i18n/catalog/<locale>.json) keyed by the
 * ENGLISH text, so a missing entry shows English, never a raw key or an empty string.
 *
 * Placeholders are positional: `tx("Minimum: {0}", "Minimum: {0}", amount)`. Translators may move
 * them but must keep every one (tests/unit/i18n/catalog-parity.test.ts).
 */
export type Catalog = Readonly<Record<string, string>>;
export type TxArg = string | number;
export type Tx = {
  (pl: string, en: string, ...args: TxArg[]): string;
  /** Language this `tx` translates into (`tx.language === "pl"` replaces a separate isPl flag). */
  readonly language: Locale;
};

export const PLACEHOLDER_PATTERN = /\{(\d+)\}/g;

/** Sorted list of the placeholder indexes a string uses ("{1} of {0}" -> ["0", "1"]). */
export function placeholdersOf(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(PLACEHOLDER_PATTERN), (m) => m[1] as string))).sort();
}

export function interpolate(template: string, args: readonly TxArg[]): string {
  if (args.length === 0) return template;
  return template.replace(PLACEHOLDER_PATTERN, (whole, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? whole : String(value);
  });
}

/** The translation of an English source text, or the English text itself when none is usable. */
export function lookupTranslation(catalog: Catalog | null | undefined, en: string): string {
  const found = catalog?.[en];
  return typeof found === "string" && found.trim() !== "" ? found : en;
}

export function createTx(language: Locale, catalog?: Catalog | null): Tx {
  const translate = (pl: string, en: string, args: readonly TxArg[]) => {
    if (language === "pl") return interpolate(pl, args);
    if (language === "en") return interpolate(en, args);
    return interpolate(lookupTranslation(catalog, en), args);
  };
  return Object.assign((pl: string, en: string, ...args: TxArg[]) => translate(pl, en, args), { language });
}

/**
 * Plural form via the language's own CLDR rules (Intl.PluralRules): pass the forms the language
 * has (`one`, `few`, `many`, `other`); a missing form falls back to `other`.
 */
export function pluralForm<T extends string>(
  language: Locale,
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, T>> & { other: T },
): T {
  const rule = new Intl.PluralRules(intlLocale(language)).select(count);
  return forms[rule] ?? forms.other;
}

/**
 * BCP 47 tag for `Intl` and date formatting: a region is always given so server and browser format
 * alike. English defaults to en-US (some screens pass "en-GB"); Portuguese is Brazilian and Chinese
 * Simplified (docs/operations/I18N.md).
 */
export function intlLocale(language: Locale, english = "en-US"): string {
  switch (language) {
    case "pl":
      return "pl-PL";
    case "en":
      return english;
    case "de":
      return "de-DE";
    case "es":
      return "es-ES";
    case "fr":
      return "fr-FR";
    case "it":
      return "it-IT";
    case "pt":
      return "pt-BR";
    case "zh":
      return "zh-CN";
  }
}

/** Value of `<html lang>`. zh -> zh-CN so browsers pick Simplified glyphs; pt -> pt-BR (our Portuguese). */
export const htmlLang = (language: Locale): string => (language === "pt" ? "pt-BR" : language === "zh" ? "zh-CN" : language);

/** Language tag Cloudflare Turnstile accepts for its widget text. */
export function turnstileLanguage(language: Locale): string {
  switch (language) {
    case "pt":
      return "pt-br";
    case "zh":
      return "zh-cn";
    default:
      return language;
  }
}

/** Locale Stripe Elements accepts (Stripe supports all eight; Portuguese is the Brazilian one). */
export function stripeLocale(language: Locale): "pl" | "en" | "de" | "es" | "fr" | "it" | "pt-BR" | "zh" {
  return language === "pt" ? "pt-BR" : language;
}
