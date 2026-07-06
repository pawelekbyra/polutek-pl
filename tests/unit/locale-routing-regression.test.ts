import { describe, expect, it } from "vitest";
import { getLocalizedHref, localizedPathFromLegacyPath, switchLocalePath } from "@/lib/i18n/routing";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("locale-first routing regression coverage", () => {
  it("keeps Polish home canonical unprefixed and English under /en", () => {
    expect(getLocalizedHref("pl", "home")).toBe("/");
    expect(getLocalizedHref("en", "home")).toBe("/en");
  });

  it("switches public language routes without a public /pl canonical", () => {
    expect(switchLocalePath("/", "en")).toBe("/en");
    expect(switchLocalePath("/en", "pl")).toBe("/");
    expect(switchLocalePath("/watch/abc", "en")).toBe("/en/watch/abc");
    expect(switchLocalePath("/en/watch/abc", "pl")).toBe("/watch/abc");
    expect(switchLocalePath("/channel/polutek", "en")).toBe("/en/channel/polutek");
    expect(switchLocalePath("/en/channel/polutek", "pl")).toBe("/channel/polutek");
    expect(switchLocalePath("/search", "en")).toBe("/en/search");
    expect(switchLocalePath("/en/search", "pl")).toBe("/search");
    expect(switchLocalePath("/regulamin", "en")).toBe("/en/terms");
    expect(switchLocalePath("/en/terms", "pl")).toBe("/regulamin");
    expect(switchLocalePath("/polityka-prywatnosci", "en")).toBe("/en/privacy-policy");
    expect(switchLocalePath("/en/privacy-policy", "pl")).toBe("/polityka-prywatnosci");
    expect(switchLocalePath("/sklep", "en")).toBe("/en/shop");
    expect(switchLocalePath("/en/shop", "pl")).toBe("/sklep");
  });

  it("maps legacy /pl routes to the canonical Polish routes", () => {
    expect(localizedPathFromLegacyPath("/pl", "pl")).toBe("/");
    expect(localizedPathFromLegacyPath("/pl/search", "pl")).toBe("/search");
    expect(localizedPathFromLegacyPath("/pl/watch/abc", "pl")).toBe("/watch/abc");
    expect(localizedPathFromLegacyPath("/pl/channel/polutek", "pl")).toBe("/channel/polutek");
    expect(localizedPathFromLegacyPath("/pl/regulamin", "pl")).toBe("/regulamin");
    expect(localizedPathFromLegacyPath("/pl/polityka-prywatnosci", "pl")).toBe("/polityka-prywatnosci");
    expect(localizedPathFromLegacyPath("/pl/sklep", "pl")).toBe("/sklep");
  });

  it("keeps SidebarPlaylist clicks on home with ?v instead of watch pages", () => {
    const sidebar = source("app/components/channel/SidebarPlaylist.tsx");
    expect(sidebar).toContain('const homeHref = `${language === "pl" ? "/" : "/en"}?${new URLSearchParams({ v: video.slug || video.id }).toString()}`');
    expect(sidebar).toContain("href={homeHref}");
    expect(sidebar).not.toContain('getLocalizedHref(language === "pl" ? "pl" : "en", "watch"');
  });

  it("redirects legacy /pl paths in middleware before auth", () => {
    const middleware = source("middleware.ts");
    expect(middleware).toContain("if (pathname === '/pl') return '/';");
    expect(middleware).toContain("return NextResponse.redirect(targetUrl, 308);");
  });
});
