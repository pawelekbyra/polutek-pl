import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import middleware from "@/middleware";
import { generateCSP } from "@/lib/utils/security";
import { ROUTE_LOCALE_HEADER } from "@/lib/i18n/routing";
import { resolveEmbedLanguage } from "@/lib/i18n/accept-language";

const ORIGIN = "https://www.pawelperfect.com";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}${path}`, { headers: new Headers({ host: "www.pawelperfect.com", ...headers }) });
}

const directive = (csp: string, name: string) => csp.split("; ").find((part) => part === name || part.startsWith(`${name} `)) ?? "";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
});

describe("generateCSP: framing is decided in this one place", () => {
  it("forbids framing by default", () => {
    expect(directive(generateCSP(), "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(generateCSP({}), "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(generateCSP({ embeddable: false }), "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("lets any site frame an embeddable response", () => {
    expect(directive(generateCSP({ embeddable: true }), "frame-ancestors")).toBe("frame-ancestors *");
  });

  it("changes nothing else between the two policies", () => {
    const strip = (csp: string) => csp.split("; ").filter((part) => !part.startsWith("frame-ancestors"));
    expect(strip(generateCSP({ embeddable: true }))).toEqual(strip(generateCSP()));
  });
});

describe("proxy: only /embed/<slug> may be framed", () => {
  it("sends frame-ancestors * and noindex for the embed page", async () => {
    const res = await middleware(request("/embed/moj-film"));
    expect(res.status).toBe(200);
    expect(directive(res.headers.get("content-security-policy") ?? "", "frame-ancestors")).toBe("frame-ancestors *");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("keeps the embed address as it is (no /pl rewrite) and needs no session", async () => {
    const res = await middleware(request("/embed/moj-film"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });

  it.each([
    "/",
    "/pl",
    "/en?v=moj-film",
    "/watch/moj-film",
    "/channel/pawel",
    "/channel/pawel/feed.xml",
    "/regulamin",
    "/api/oembed?url=x",
    "/api/media-source/abc",
    "/embed/a/b",
  ])("keeps frame-ancestors 'none' for %s", async (path) => {
    const res = await middleware(request(path));
    expect(directive(res.headers.get("content-security-policy") ?? "", "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it.each(["/embed", "/embedded/a", "/pl/embed/moj-film"])("never makes %s framable (not an embed address, gated like any page)", async (path) => {
    const res = await middleware(request(path));
    expect(res.headers.get("content-security-policy") ?? "").not.toContain("frame-ancestors *");
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });

  it("does not add noindex to the other public responses by itself", async () => {
    const res = await middleware(request("/channel/pawel/feed.xml"));
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("proxy: syndication routes", () => {
  it.each(["/channel/pawel/feed.xml", "/api/oembed", "/embed/moj-film"])("lets %s through without a session", async (path) => {
    const res = await middleware(request(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not rewrite the feed to /pl (it has no language prefix)", async () => {
    const res = await middleware(request("/channel/pawel/feed.xml"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("still rewrites the ordinary bare channel page to /pl", async () => {
    const res = await middleware(request("/channel/pawel"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/pl/channel/pawel");
  });
});

describe("embed language: from the URL and request headers only", () => {
  function forwardedLocale(res: Response): string | null {
    return res.headers.get(`x-middleware-request-${ROUTE_LOCALE_HEADER}`);
  }

  it("takes ?lang= first, then the country, then Accept-Language, then English", async () => {
    expect(forwardedLocale(await middleware(request("/embed/x?lang=de", { "accept-language": "pl" })))).toBe("de");
    expect(forwardedLocale(await middleware(request("/embed/x", { "cf-ipcountry": "PL", "accept-language": "de" })))).toBe("pl");
    expect(forwardedLocale(await middleware(request("/embed/x", { "accept-language": "fr-FR,fr;q=0.9" })))).toBe("fr");
    expect(forwardedLocale(await middleware(request("/embed/x")))).toBe("en");
  });

  it("ignores an unsupported ?lang= and a client-sent route-locale header", async () => {
    expect(forwardedLocale(await middleware(request("/embed/x?lang=xx", { [ROUTE_LOCALE_HEADER]: "zh", "accept-language": "es" })))).toBe("es");
  });

  it("resolveEmbedLanguage is pure and total", () => {
    expect(resolveEmbedLanguage({})).toBe("en");
    expect(resolveEmbedLanguage({ langParam: "PL" })).toBe("pl");
    expect(resolveEmbedLanguage({ langParam: "nope", acceptLanguage: "it" })).toBe("it");
  });
});

describe("next.config.mjs: X-Frame-Options stays off exactly the embed path", () => {
  it("applies the legacy DENY header to every path except /embed/*", async () => {
    const config = (await import("../../../next.config.mjs")).default as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> };
    const entries = await config.headers();
    const withXfo = entries.filter((entry) => entry.headers.some((header) => header.key === "X-Frame-Options"));
    expect(withXfo).toHaveLength(1);
    expect(withXfo[0]?.headers).toEqual([{ key: "X-Frame-Options", value: "DENY" }]);

    // The source is a path-to-regexp pattern with one unnamed group, "/(<group>)": test the group as the regexp it is.
    const group = /^\/\((.*)\)$/.exec(withXfo[0]?.source ?? "")?.[1];
    expect(group).toBeTruthy();
    const matches = (path: string) => new RegExp(`^(?:${group})$`).test(path.replace(/^\//, ""));
    for (const framed of ["embed/moj-film", "embed/a/b"]) expect(matches(framed)).toBe(false);
    for (const guarded of ["", "pl", "en", "watch/x", "channel/pawel/feed.xml", "api/oembed", "embedded/x", "pl/embed/x", "studio"]) {
      expect(matches(guarded)).toBe(true);
    }

    // No other header entry may reintroduce the ban, and the other security headers still cover every path.
    const everywhere = entries.find((entry) => entry.source === "/(.*)");
    expect(everywhere?.headers.map((header) => header.key)).toEqual(
      expect.arrayContaining(["X-Content-Type-Options", "Referrer-Policy", "Strict-Transport-Security", "Permissions-Policy"]),
    );
  });
});
