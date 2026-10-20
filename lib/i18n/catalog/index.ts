import type { Locale } from "@/lib/i18n/routing";
import type { Catalog } from "@/lib/i18n/ui";

/**
 * The interface catalog of a language (English source text -> translation), loaded on demand so a
 * visitor downloads only the language they use. Polish and English need none: their texts are
 * written inline at every `tx()` call. The server loads the viewer's catalog in the root layout and
 * hands it to the LanguageProvider, so the first paint is already translated.
 */
export async function loadCatalog(locale: Locale): Promise<Catalog | null> {
  const base = await loadBaseCatalog(locale);
  // experiment: premium-pass (docs/experiments/premium-pass.md): its texts live in their own files, so the revert
  // never collides with later edits of the big catalogs.
  return base ? { ...base, ...(await loadPremiumPassCatalog(locale)) } : base;
}

async function loadBaseCatalog(locale: Locale): Promise<Catalog | null> {
  switch (locale) {
    case "de":
      return (await import("./de.json")).default;
    case "es":
      return (await import("./es.json")).default;
    case "fr":
      return (await import("./fr.json")).default;
    case "it":
      return (await import("./it.json")).default;
    case "pt":
      return (await import("./pt.json")).default;
    case "zh":
      return (await import("./zh.json")).default;
    default:
      return null;
  }
}

// experiment: premium-pass
async function loadPremiumPassCatalog(locale: Locale): Promise<Catalog> {
  switch (locale) {
    case "de":
      return (await import("./premium-pass/de.json")).default;
    case "es":
      return (await import("./premium-pass/es.json")).default;
    case "fr":
      return (await import("./premium-pass/fr.json")).default;
    case "it":
      return (await import("./premium-pass/it.json")).default;
    case "pt":
      return (await import("./premium-pass/pt.json")).default;
    case "zh":
      return (await import("./premium-pass/zh.json")).default;
    default:
      return {};
  }
}
