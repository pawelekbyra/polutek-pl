import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBetaFlag } from "@/lib/site-stage";
import { getBetaSiteText, getStageRobots } from "@/lib/site-stage-metadata";
import { UI_ONLY_LOCALES } from "@/lib/i18n/routing";

describe("parseBetaFlag", () => {
  it("is ON by default and for any value that is not an explicit 'false'", () => {
    expect(parseBetaFlag(undefined)).toBe(true);
    expect(parseBetaFlag("")).toBe(true);
    expect(parseBetaFlag("true")).toBe(true);
    expect(parseBetaFlag("1")).toBe(true);
    expect(parseBetaFlag("banana")).toBe(true);
  });
  it("is OFF for false/0/no/off in any case", () => {
    for (const v of ["false", "FALSE", " False ", "0", "no", "off"]) expect(parseBetaFlag(v)).toBe(false);
  });
});

describe("metadata while beta", () => {
  it("marks pages noindex, nofollow, and nothing after launch", () => {
    expect(getStageRobots(true)).toEqual({ index: false, follow: false });
    expect(getStageRobots(false)).toBeUndefined();
  });

  it("gives a neutral localized title and description, and null after launch", async () => {
    expect(await getBetaSiteText("pl", false)).toBeNull();
    const pl = await getBetaSiteText("pl", true);
    expect(pl?.title).toMatch(/platforma wideo \(wersja testowa\)$/);
    expect(pl?.description).toContain("w budowie");
    const en = await getBetaSiteText("en", true);
    expect(en?.title).toMatch(/video platform \(test version\)$/);
    expect(en?.description).not.toMatch(/NIE MASZ PSYCHY/i);
    for (const locale of UI_ONLY_LOCALES) {
      const text = await getBetaSiteText(locale, true);
      expect(text?.title).not.toBe(en?.title);
      expect(text?.description).not.toBe(en?.description);
      expect(text?.title).not.toContain("{0}");
    }
  });
});

describe("X-Robots-Tag header (next.config.mjs)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadHeaders(beta: string | undefined) {
    vi.resetModules();
    if (beta === undefined) vi.stubEnv("NEXT_PUBLIC_SITE_BETA", undefined as unknown as string);
    else vi.stubEnv("NEXT_PUBLIC_SITE_BETA", beta);
    const mod = await import("../../../next.config.mjs");
    return (await mod.default.headers()) as Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  }
  const robotsRule = (rules: Awaited<ReturnType<typeof loadHeaders>>) =>
    rules.find((r) => r.headers.some((h) => h.key === "X-Robots-Tag"));

  it("is sent for HTML pages by default and not for assets, api or _next", async () => {
    const rule = robotsRule(await loadHeaders(undefined));
    expect(rule?.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
    // Next matches `source` as path-to-regexp; the negative lookahead is a plain regex group.
    const re = new RegExp(`^${rule!.source}$`);
    for (const path of ["/", "/pl", "/en/regulamin", "/watch/abc", "/admin/x"]) expect(re.test(path)).toBe(true);
    for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.json", "/api/health", "/_next/static/a.js", "/rabbit-32.png"]) expect(re.test(path)).toBe(false);
  });

  it("is absent after launch (NEXT_PUBLIC_SITE_BETA=false), the other headers stay", async () => {
    const rules = await loadHeaders("false");
    expect(robotsRule(rules)).toBeUndefined();
    expect(rules[0]?.headers.some((h) => h.key === "X-Content-Type-Options")).toBe(true);
  });
});

describe("robots.txt and sitemap while beta", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("robots keeps crawling allowed and the Disallow rules, but advertises no sitemap in beta", async () => {
    vi.resetModules();
    const beta = (await import("@/app/robots")).default();
    expect(beta.sitemap).toBeUndefined();
    const rule = Array.isArray(beta.rules) ? beta.rules[0] : beta.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/admin/", "/api/"]));

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_BETA", "false");
    const launched = (await import("@/app/robots")).default();
    expect(launched.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("sitemap is empty in beta", async () => {
    vi.resetModules();
    const sitemap = (await import("@/app/sitemap")).default;
    expect(await sitemap()).toEqual([]);
  });
});
