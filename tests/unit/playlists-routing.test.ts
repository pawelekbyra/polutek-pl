import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROUTES, SUPPORTED_LOCALES, getLocalizedHref, localizedPathFromLegacyPath, switchLocalePath } from "@/lib/i18n/routing";

describe("playlist route keys", () => {
  it("every route has a Polish and an English path, and the playlist route names both params", () => {
    for (const [key, value] of Object.entries(ROUTES)) {
      expect(typeof value.pl, key).toBe("string");
      expect(typeof value.en, key).toBe("string");
    }
    expect(ROUTES.playlist.pl).toContain(":channel");
    expect(ROUTES.playlist.pl).toContain(":slug");
    expect(ROUTES.playlist.en).toContain(":channel");
    expect(ROUTES.playlist.en).toContain(":slug");
  });

  it("builds the address for all eight languages (the UI-only ones mirror the English route)", () => {
    const params = { channel: "main", slug: "best of" };
    expect(getLocalizedHref("pl", "playlist", params)).toBe("/playlista/main/best%20of");
    expect(getLocalizedHref("en", "playlist", params)).toBe("/en/playlist/main/best%20of");
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "pl" && l !== "en")) {
      expect(getLocalizedHref(locale, "playlist", params)).toBe(`/${locale}/playlist/main/best%20of`);
    }
  });

  it("refuses to build an address without its params", () => {
    expect(() => getLocalizedHref("pl", "playlist", { slug: "x" })).toThrow();
    expect(() => getLocalizedHref("pl", "playlist", { channel: "x" })).toThrow();
  });

  it("is kept by the language switcher and the legacy-path mapping", () => {
    expect(switchLocalePath("/playlista/main/hity", "en")).toBe("/en/playlist/main/hity");
    expect(switchLocalePath("/pl/playlista/main/hity", "de")).toBe("/de/playlist/main/hity");
    expect(switchLocalePath("/en/playlist/main/hity", "pl")).toBe("/playlista/main/hity");
    expect(switchLocalePath("/de/playlist/main/hity", "fr")).toBe("/fr/playlist/main/hity");
    expect(localizedPathFromLegacyPath("/playlist/main/hity", "en")).toBe("/en/playlist/main/hity");
    expect(localizedPathFromLegacyPath("/playlista/main/hity", "pl")).toBe("/playlista/main/hity");
  });

  it("is public in the proxy for every language and has a page folder for both spellings", () => {
    const middleware = readFileSync("middleware.ts", "utf8");
    for (const route of ["'/pl/playlista/(.*)'", "'/pl/playlist/(.*)'", "'/en/playlist/(.*)'", "'/en/playlista/(.*)'", "'/playlista/(.*)'", "'/playlist/(.*)'", "`/${locale}/playlist/(.*)`"]) {
      expect(middleware, route).toContain(route);
    }
    expect(existsSync("app/[locale]/playlista/[channel]/[slug]/page.tsx")).toBe(true);
    expect(existsSync("app/[locale]/playlist/[channel]/[slug]/page.tsx")).toBe(true);
  });
});
