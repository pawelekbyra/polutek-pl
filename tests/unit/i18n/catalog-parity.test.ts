import { describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/i18n/catalog";
import { translations } from "@/lib/i18n/dictionary";
import { SUPPORTED_LOCALES, UI_ONLY_LOCALES, type Locale } from "@/lib/i18n/routing";
import { placeholdersOf } from "@/lib/i18n/ui";
import { LANGUAGE_OPTIONS } from "@/app/components/language-switcher/languages";
import { extractTxCalls, groupByEnglish } from "./extract-tx";

const { calls, problems } = extractTxCalls();
const sources = groupByEnglish(calls);

describe("tx() call sites", () => {
  it("only use plain string literals, so every text can be checked", () => {
    expect(problems).toEqual([]);
  });

  it("find the interface texts of the app", () => {
    expect(calls.length).toBeGreaterThan(400);
  });

  it("use the same placeholders in the Polish and the English text", () => {
    const mismatches = calls
      .filter((call) => placeholdersOf(call.pl).join() !== placeholdersOf(call.en).join())
      .map((call) => `${call.file}:${call.line} ${call.en}`);
    expect(mismatches).toEqual([]);
  });
});

describe.each(UI_ONLY_LOCALES)("catalog %s", (locale) => {
  it("has a translation for every English text in the code, and nothing else", async () => {
    const catalog = (await loadCatalog(locale)) ?? {};
    const keys = new Set(Object.keys(catalog));
    const missing = [...sources.keys()].filter((en) => !keys.has(en));
    const orphans = [...keys].filter((key) => !sources.has(key));
    expect({ missing, orphans }).toEqual({ missing: [], orphans: [] });
  });

  it("keeps every placeholder and the surrounding whitespace, and is never empty", async () => {
    const catalog = (await loadCatalog(locale)) ?? {};
    const broken: string[] = [];
    for (const [en, translated] of Object.entries(catalog)) {
      if (translated.trim() === "") broken.push(`empty: ${en}`);
      if (placeholdersOf(translated).join() !== placeholdersOf(en).join()) broken.push(`placeholders: ${en}`);
      if (/^\s/.test(translated) !== /^\s/.test(en) || /\s$/.test(translated) !== /\s$/.test(en)) broken.push(`whitespace: ${en}`);
      if (/<[a-z/][^>]*>/i.test(translated)) broken.push(`markup: ${en}`);
    }
    expect(broken).toEqual([]);
  });

  it("actually translates (most texts differ from the English source)", async () => {
    const catalog = (await loadCatalog(locale)) ?? {};
    const entries = Object.entries(catalog);
    const same = entries.filter(([en, translated]) => en === translated).length;
    expect(same / entries.length).toBeLessThan(0.15);
  });
});

describe("short-phrase dictionary (t.*)", () => {
  it("has every key, non-empty, in all eight languages", () => {
    const keys = Object.keys(translations.en).sort();
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(translations[locale]).sort()).toEqual(keys);
      for (const value of Object.values(translations[locale])) expect(value.trim()).not.toBe("");
    }
  });
});

describe("declared languages", () => {
  it("every language of the switcher is a supported locale with a complete setup", async () => {
    expect(LANGUAGE_OPTIONS.map((o) => o.locale).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES as readonly Locale[]) {
      const catalog = await loadCatalog(locale);
      if (locale === "pl" || locale === "en") expect(catalog).toBeNull();
      else expect(Object.keys(catalog ?? {}).length).toBe(sources.size);
    }
  });
});
