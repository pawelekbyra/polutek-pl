import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countedNoun } from "@/lib/i18n/plurals";
import { SUPPORTED_LOCALES } from "@/lib/i18n/routing";
import { formatCount } from "@/lib/utils";

describe("N02: formatCount follows the language through Intl", () => {
  it("keeps the English-style K/M when no language is given (old call sites)", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1500)).toBe("1.5K");
    expect(formatCount(2_000_000)).toBe("2M");
  });

  it("uses the language's own decimal separator and abbreviation", () => {
    expect(formatCount(1500, "en")).toBe("1.5K");
    expect(formatCount(1500, "pl")).toMatch(/^1,5\s+tys\.$/);
    expect(formatCount(1500, "fr")).toMatch(/^1,5\s?k$/);
    expect(formatCount(999, "de")).toBe("999");
    for (const language of SUPPORTED_LOCALES) expect(formatCount(12_500, language)).not.toBe("");
  });

  it("every call site passes the language", () => {
    for (const file of [
      "app/components/Hero.tsx",
      "app/components/channel/ChannelAbout.tsx",
      "app/components/subscriptions/MySubscriptionsList.tsx",
      "app/[locale]/channel/[slug]/page.tsx",
    ]) {
      const calls = readFileSync(join(process.cwd(), file), "utf8").match(/formatCount\([^)]*\)/g) ?? [];
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(call, `${file}: ${call}`).toMatch(/,\s*(language|locale)\)/);
    }
  });
});

describe("N01: Hero counters use the counted-noun rules", () => {
  it("views and subscribers get the right Polish and English forms", () => {
    expect(countedNoun("pl", "views", 1)).toBe("wyświetlenie");
    expect(countedNoun("pl", "views", 2)).toBe("wyświetlenia");
    expect(countedNoun("pl", "views", 5)).toBe("wyświetleń");
    expect(countedNoun("en", "views", 1)).toBe("view");
    expect(countedNoun("en", "views", 2)).toBe("views");
    expect(countedNoun("pl", "subscribers", 1)).toBe("subskrajber");
    expect(countedNoun("pl", "subscribers", 5)).toBe("subskrajberów");
    expect(countedNoun("en", "subscribers", 1)).toBe("subscriber");
    expect(countedNoun("fr", "subscribers", 0)).toBe("abonné"); // French treats 0 like 1
    expect(countedNoun("zh", "subscribers", 7)).toBe("订阅者");
  });

  it("Hero no longer hard-codes t.views / the 1-or-rest subscriber label", () => {
    const hero = readFileSync(join(process.cwd(), "app/components/Hero.tsx"), "utf8");
    expect(hero).toContain('countedNoun(language, "views", localViewsCount)');
    expect(hero).toContain('countedNoun(language, "subscribers", subscribersCount)');
    expect(hero).not.toContain("t.subscribersOne");
    expect(hero).not.toMatch(/\} \{t\.views\}/);
  });
});
