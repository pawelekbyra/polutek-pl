import { describe, expect, it } from "vitest";
import { SLUG_MAX, TRANSLATION_LANGUAGES, isSubtitleLanguage, isValidSlug, resolveFilmText, slugBase, translationPublicMeta, transliterate, uniqueSlug } from "@/lib/modules/translations";

describe("slugBase (transliteration)", () => {
  it("folds accents of every Latin language we offer", () => {
    expect(slugBase("Hinter den Kulissen: Teil 2!", "de")).toBe("hinter-den-kulissen-teil-2");
    expect(slugBase("Les coulisses : épisode spécial", "fr")).toBe("les-coulisses-episode-special");
    expect(slugBase("¿Qué pasó en el rodaje?", "es")).toBe("que-paso-en-el-rodaje");
    expect(slugBase("Bastidores: edição", "pt")).toBe("bastidores-edicao");
    expect(slugBase("Dietro le quinte, così", "it")).toBe("dietro-le-quinte-cosi");
    expect(slugBase("Zażółć gęślą jaźń", "pl")).toBe("zazolc-gesla-jazn");
  });

  it("writes German umlauts and ß the German way", () => {
    expect(slugBase("Grüße aus München", "de")).toBe("gruesse-aus-muenchen");
    expect(slugBase("Grüße aus München", "en")).toBe("grusse-aus-munchen");
  });

  it("spells & in the language and drops apostrophes", () => {
    expect(slugBase("Tom & Jerry's day", "en")).toBe("tom-and-jerrys-day");
    expect(slugBase("Kamera & Ton", "de")).toBe("kamera-und-ton");
    expect(transliterate("æøœ", "en")).toBe("aeooe");
  });

  it("is empty for a title without Latin letters (Chinese)", () => {
    expect(slugBase("幕后花絮", "zh")).toBe("");
  });

  it("keeps at most 80 characters and never ends with a dash", () => {
    const s = slugBase(`${"słowo ".repeat(30)}`, "pl");
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug (collisions)", () => {
  it("adds -2, -3, ... while the address is taken in that language", () => {
    const taken = new Set(["kulisy", "kulisy-2"]);
    expect(uniqueSlug("Kulisy", "pl", (s) => taken.has(s), "x")).toBe("kulisy-3");
    expect(uniqueSlug("Kulisy", "pl", () => false, "x")).toBe("kulisy");
  });

  it("keeps the suffix inside 80 characters", () => {
    const long = "a".repeat(80);
    const s = uniqueSlug(long, "en", (x) => x === long, "x");
    expect(s).toBe(`${"a".repeat(78)}-2`);
    expect(s.length).toBe(SLUG_MAX);
  });

  it("falls back to the original address when the title has no Latin letters", () => {
    expect(uniqueSlug("幕后花絮", "zh", () => false, "kulisy-montazu")).toBe("kulisy-montazu");
    expect(uniqueSlug("幕后花絮", "zh", (s) => s === "kulisy-montazu", "kulisy-montazu")).toBe("kulisy-montazu-2");
    expect(uniqueSlug("…", "zh", () => false, "")).toBe("film");
  });

  it("validates typed addresses", () => {
    expect(isValidSlug("behind-the-scenes-2")).toBe(true);
    for (const bad of ["", "Behind", "a--b", "-a", "a-", "ą", "a b", "x".repeat(81)]) expect(isValidSlug(bad)).toBe(false);
  });
});

describe("languages", () => {
  it("never lists Polish as a translation (it is the original) and accepts it for subtitles", () => {
    expect(TRANSLATION_LANGUAGES.map((l) => l.code)).toEqual(["en", "de", "es", "fr", "it", "pt", "zh"]);
    expect(isSubtitleLanguage("pl")).toBe(true);
    expect(isSubtitleLanguage("de")).toBe(true);
    expect(isSubtitleLanguage("ru")).toBe(false);
  });
});

describe("public rules", () => {
  it("machine drafts are labelled, noindex and out of the sitemap; approved and edited are normal pages", () => {
    expect(translationPublicMeta("AI_DRAFT")).toEqual({ autoTranslatedLabel: true, noindex: true, inSitemap: false });
    expect(translationPublicMeta("APPROVED")).toEqual({ autoTranslatedLabel: false, noindex: false, inSitemap: true });
    expect(translationPublicMeta("EDITED")).toEqual({ autoTranslatedLabel: false, noindex: false, inSitemap: true });
  });

  const video = { title: "Kulisy", description: "Opis", titleEn: "Backstage", descriptionEn: "About", subtitleUrlPl: "pl.vtt", subtitleUrlEn: "en.vtt" };

  it("reads the old EN columns while there is no EN row", () => {
    expect(resolveFilmText(video, [], "en")).toMatchObject({ title: "Backstage", subtitleUrl: "en.vtt", status: "EDITED", fallback: false });
  });

  it("a translation row wins; a missing language falls back to the original", () => {
    const rows = [{ language: "de", title: "Hinter den Kulissen", description: null, subtitleUrl: null, status: "AI_DRAFT" as const }];
    expect(resolveFilmText(video, rows, "de")).toMatchObject({ title: "Hinter den Kulissen", status: "AI_DRAFT" });
    expect(resolveFilmText(video, rows, "fr")).toMatchObject({ title: "Kulisy", fallback: true, subtitleUrl: null });
    expect(resolveFilmText(video, rows, "pl")).toMatchObject({ title: "Kulisy", subtitleUrl: "pl.vtt", status: "ORIGINAL" });
  });
});
