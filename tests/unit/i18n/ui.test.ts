import { describe, expect, it } from "vitest";
import { createTx, htmlLang, interpolate, intlLocale, lookupTranslation, placeholdersOf, pluralForm, stripeLocale, turnstileLanguage } from "@/lib/i18n/ui";
import { countedNoun } from "@/lib/i18n/plurals";
import { SUPPORTED_LOCALES } from "@/lib/i18n/routing";
import { translations } from "@/lib/i18n/dictionary";

describe("createTx", () => {
  it("returns the Polish or English text given inline", () => {
    expect(createTx("pl")("Cześć", "Hello")).toBe("Cześć");
    expect(createTx("en")("Cześć", "Hello")).toBe("Hello");
  });

  it("looks other languages up by the English text", () => {
    const tx = createTx("de", { Hello: "Hallo", "Hi {0}": "Hallo {0}" });
    expect(tx("Cześć", "Hello")).toBe("Hallo");
    expect(tx("Cześć {0}", "Hi {0}", "Ola")).toBe("Hallo Ola");
    expect(tx.language).toBe("de");
  });

  it("falls back to English, never a raw key or an empty string", () => {
    expect(createTx("fr")("Cześć", "Hello")).toBe("Hello");
    expect(createTx("fr", {})("Cześć", "Hello")).toBe("Hello");
    expect(createTx("fr", { Hello: "" })("Cześć", "Hello")).toBe("Hello");
    expect(createTx("fr", { Hello: "   " })("Cześć", "Hello")).toBe("Hello");
    expect(lookupTranslation(null, "Hello")).toBe("Hello");
  });

  it("fills placeholders in any order and leaves unknown ones visible", () => {
    expect(interpolate("{1} of {0}", [5, "x"])).toBe("x of 5");
    expect(interpolate("{2}", ["a"])).toBe("{2}");
    expect(placeholdersOf("{1} {0} {1}")).toEqual(["0", "1"]);
  });
});

describe("locale helpers", () => {
  it("give each language a region-qualified Intl locale (Brazilian Portuguese, Simplified Chinese)", () => {
    expect(SUPPORTED_LOCALES.map((l) => intlLocale(l))).toEqual(["pl-PL", "en-US", "de-DE", "es-ES", "fr-FR", "it-IT", "pt-BR", "zh-CN"]);
    expect(intlLocale("en", "en-GB")).toBe("en-GB");
    expect(htmlLang("zh")).toBe("zh-CN");
    expect(htmlLang("pt")).toBe("pt-BR");
    expect(htmlLang("de")).toBe("de");
    expect(turnstileLanguage("zh")).toBe("zh-cn");
    expect(stripeLocale("pt")).toBe("pt-BR");
  });

  it("format numbers and dates in the language's own conventions", () => {
    expect(new Intl.NumberFormat(intlLocale("de")).format(1234567.5)).toBe("1.234.567,5");
    expect(new Intl.NumberFormat(intlLocale("fr")).format(1234.5)).toMatch(/^1\s234,5$/);
    expect(new Intl.NumberFormat(intlLocale("en")).format(1234.5)).toBe("1,234.5");
    expect(new Date(Date.UTC(2026, 9, 5)).toLocaleDateString(intlLocale("zh"), { timeZone: "UTC" })).toBe("2026/10/5");
    expect(new Date(Date.UTC(2026, 9, 5)).toLocaleDateString(intlLocale("de"), { timeZone: "UTC" })).toBe("5.10.2026");
  });
});

describe("plural rules", () => {
  it("pick the right form per language", () => {
    expect([1, 2, 5, 12, 22].map((n) => countedNoun("pl", "videos", n))).toEqual(["film", "filmy", "filmów", "filmów", "filmy"]);
    expect([1, 2].map((n) => countedNoun("en", "views", n))).toEqual(["view", "views"]);
    expect([0, 1, 2].map((n) => countedNoun("fr", "comments", n))).toEqual(["commentaire", "commentaire", "commentaires"]);
    expect([0, 1, 2].map((n) => countedNoun("pt", "comments", n))).toEqual(["comentário", "comentário", "comentários"]);
    expect([1, 5].map((n) => countedNoun("de", "videos", n))).toEqual(["Video", "Videos"]);
    expect([1, 5].map((n) => countedNoun("zh", "comments", n))).toEqual(["条评论", "条评论"]);
    expect(pluralForm("en", 3, { other: "x", one: "y" })).toBe("x");
  });

  it("have a form for every counted noun in every language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const noun of ["views", "videos", "comments"] as const) {
        for (const n of [0, 1, 2, 3, 5, 11, 22, 100]) expect(countedNoun(locale, noun, n).trim()).not.toBe("");
      }
    }
  });
});

describe("the short-phrase dictionary never reaches the UI empty", () => {
  it("has non-empty text for every key", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const [key, value] of Object.entries(translations[locale])) expect(value, `${locale}.${key}`).toBeTruthy();
    }
  });
});
