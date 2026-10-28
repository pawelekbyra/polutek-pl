import { describe, expect, it } from "vitest";
import { REAL_URL_STATE_KEY, resolveRealLocation, withRealUrl } from "@/lib/i18n/real-location";
import { getRouteLocaleFromPathname, isHomePathname, switchLocaleHref } from "@/lib/i18n/routing";

const masked = { pathname: "/", search: "" };

describe("real location behind the masked address bar (S01)", () => {
  it("returns what UrlMask remembered while the bar shows the bare '/'", () => {
    const state = withRealUrl({ __NA: true }, { pathname: "/de/channel/pawel", search: "?tab=videos" });
    expect(state).toMatchObject({ __NA: true, [REAL_URL_STATE_KEY]: "/de/channel/pawel?tab=videos" });
    expect(resolveRealLocation(masked, state)).toEqual({ pathname: "/de/channel/pawel", search: "?tab=videos" });
  });

  it("the bar wins as soon as it names something (a shallow video switch pushes /?v=)", () => {
    const state = withRealUrl(null, { pathname: "/channel/old", search: "" });
    expect(resolveRealLocation({ pathname: "/", search: "?v=film" }, state)).toEqual({ pathname: "/", search: "?v=film" });
  });

  it("a clean '/' in an entry without a remembered page is the home page", () => {
    expect(resolveRealLocation(masked, { __NA: true })).toEqual(masked);
    expect(resolveRealLocation(masked, null)).toEqual(masked);
  });

  it("ignores a remembered value that is not a same-origin path", () => {
    for (const bad of ["https://evil.example/x", "//evil.example/x", "/\\evil.example", 5, null]) {
      expect(resolveRealLocation(masked, { [REAL_URL_STATE_KEY]: bad })).toEqual(masked);
    }
  });

  it("drops a hash from the remembered page", () => {
    expect(resolveRealLocation(masked, { [REAL_URL_STATE_KEY]: "/en/search?q=a#x" })).toEqual({ pathname: "/en/search", search: "?q=a" });
  });
});

describe("switchLocaleHref keeps the real page and its query (S01)", () => {
  it("channel, search, playlist and the ?v= video stay what they are in the new language", () => {
    expect(switchLocaleHref("/de/channel/pawel", "", "fr")).toBe("/fr/channel/pawel");
    expect(switchLocaleHref("/channel/pawel", "?x=1", "pl")).toBe("/channel/pawel?x=1");
    expect(switchLocaleHref("/en/search", "?q=kot&category=news&cursor=abc", "de")).toBe("/de/search?q=kot&category=news&cursor=abc");
    expect(switchLocaleHref("/search", "?q=kot", "en")).toBe("/en/search?q=kot");
    expect(switchLocaleHref("/playlista/main/lista", "", "zh")).toBe("/zh/playlist/main/lista");
    expect(switchLocaleHref("/en/playlist/main/lista", "", "pl")).toBe("/playlista/main/lista");
    expect(switchLocaleHref("/", "?v=film&list=a&i=2", "de")).toBe("/de?v=film&list=a&i=2");
    expect(switchLocaleHref("/pl", "?v=film", "en")).toBe("/en?v=film");
  });

  it("covers the other pages with their own names instead of falling back to home", () => {
    expect(switchLocaleHref("/studio", "", "en")).toBe("/en/studio");
    expect(switchLocaleHref("/regulamin", "", "de")).toBe("/de/terms");
    expect(switchLocaleHref("/regulamin-premium", "", "en")).toBe("/en/premium-terms");
    expect(switchLocaleHref("/subskrypcje", "", "fr")).toBe("/fr/subscriptions");
  });

  it("tells home from other pages", () => {
    for (const home of ["/", "/pl", "/en", "/zh", ""]) expect(isHomePathname(home)).toBe(true);
    for (const page of ["/search", "/de/search", "/channel/x", "/en/watch/y"]) expect(isHomePathname(page)).toBe(false);
    expect(getRouteLocaleFromPathname("/de/search")).toBe("de");
    expect(getRouteLocaleFromPathname("/search")).toBeNull();
  });
});
