import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  headers: new Headers(),
  userId: null as string | null,
  savedLanguage: null as string | null,
  authFails: false,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (h.cookies.has(name) ? { name, value: h.cookies.get(name)! } : undefined) }),
  headers: async () => h.headers,
}));
vi.mock("@/lib/auth/server", () => ({
  auth: async () => {
    if (h.authFails) throw new Error("db down");
    return { userId: h.userId };
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: async () => (h.savedLanguage === null ? null : { language: h.savedLanguage }) } },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import {
  languageFromAcceptLanguage,
  languageFromCountry,
  resolveDocumentLanguage,
  resolveInitialLanguage,
} from "@/lib/i18n/server-language";
import { ROUTE_LOCALE_HEADER } from "@/lib/i18n/routing";

function visitor({ cookie, country, acceptLanguage, routeLocale }: { cookie?: string; country?: string; acceptLanguage?: string; routeLocale?: string } = {}) {
  h.cookies = new Map(cookie ? [["app-language", cookie]] : []);
  h.headers = new Headers();
  if (country) h.headers.set("cf-ipcountry", country);
  if (acceptLanguage) h.headers.set("accept-language", acceptLanguage);
  if (routeLocale) h.headers.set(ROUTE_LOCALE_HEADER, routeLocale);
}

beforeEach(() => {
  h.userId = null;
  h.savedLanguage = null;
  h.authFails = false;
  visitor();
});

describe("resolveInitialLanguage: priority order", () => {
  it("defaults to English when nothing is known (no forced language any more)", async () => {
    expect(await resolveInitialLanguage()).toBe("en");
  });

  it("a signed-in viewer's saved language beats cookie, country and browser", async () => {
    h.userId = "u1";
    h.savedLanguage = "en";
    visitor({ cookie: "pl", country: "PL", acceptLanguage: "pl-PL,pl" });
    expect(await resolveInitialLanguage()).toBe("en");
    h.savedLanguage = "pl";
    visitor({ cookie: "en", country: "US", acceptLanguage: "en-US" });
    expect(await resolveInitialLanguage()).toBe("pl");
  });

  it("a signed-in viewer without a valid saved language falls back like a guest", async () => {
    h.userId = "u1";
    h.savedLanguage = "ja";
    visitor({ cookie: "pl" });
    expect(await resolveInitialLanguage()).toBe("pl");
  });

  it("falls back to the guest chain when the session or database lookup fails", async () => {
    h.authFails = true;
    visitor({ country: "PL" });
    expect(await resolveInitialLanguage()).toBe("pl");
  });

  it("a guest's cookie beats country and browser", async () => {
    visitor({ cookie: "en", country: "PL", acceptLanguage: "pl" });
    expect(await resolveInitialLanguage()).toBe("en");
    visitor({ cookie: "pl", country: "GB", acceptLanguage: "en-GB" });
    expect(await resolveInitialLanguage()).toBe("pl");
  });

  it("ignores a cookie with a language the site does not have", async () => {
    visitor({ cookie: "ja", acceptLanguage: "pl" });
    expect(await resolveInitialLanguage()).toBe("pl");
  });

  it("every one of the eight languages is honoured as a saved choice, cookie and browser language", async () => {
    for (const language of ["pl", "en", "de", "es", "fr", "it", "pt", "zh"]) {
      h.userId = "u1";
      h.savedLanguage = language;
      visitor({ cookie: "en", acceptLanguage: "pl" });
      expect(await resolveInitialLanguage()).toBe(language);
      h.userId = null;
      visitor({ cookie: language, acceptLanguage: "pl" });
      expect(await resolveInitialLanguage()).toBe(language);
    }
    visitor({ acceptLanguage: "zh-CN,zh;q=0.9" });
    expect(await resolveInitialLanguage()).toBe("zh");
    visitor({ acceptLanguage: "pt-PT,pt;q=0.9" });
    expect(await resolveInitialLanguage()).toBe("pt");
  });

  it("the account language beats the cookie, the cookie beats the country, the country beats the browser", async () => {
    h.userId = "u1";
    h.savedLanguage = "de";
    visitor({ cookie: "fr", country: "PL", acceptLanguage: "es" });
    expect(await resolveInitialLanguage()).toBe("de");
    h.userId = null;
    expect(await resolveInitialLanguage()).toBe("fr");
    visitor({ country: "PL", acceptLanguage: "es" });
    expect(await resolveInitialLanguage()).toBe("pl");
    visitor({ acceptLanguage: "es" });
    expect(await resolveInitialLanguage()).toBe("es");
  });

  it("the country (Cloudflare CF-IPCountry) beats the browser: Poland gets Polish", async () => {
    visitor({ country: "PL", acceptLanguage: "en-US,en" });
    expect(await resolveInitialLanguage()).toBe("pl");
  });

  it("a country without an available language leaves the decision to the browser", async () => {
    visitor({ country: "GB", acceptLanguage: "pl-PL,pl;q=0.9" });
    expect(await resolveInitialLanguage()).toBe("pl");
    // Germany is not in the country list: a German browser still gets German, an English one English.
    visitor({ country: "DE", acceptLanguage: "de-DE,de" });
    expect(await resolveInitialLanguage()).toBe("de");
    visitor({ country: "DE", acceptLanguage: "en-US,en" });
    expect(await resolveInitialLanguage()).toBe("en");
    visitor({ country: "JP", acceptLanguage: "ja" });
    expect(await resolveInitialLanguage()).toBe("en");
  });
});

describe("resolveDocumentLanguage (<html lang>)", () => {
  it("follows the locale written in the URL, even against the saved language", async () => {
    h.userId = "u1";
    h.savedLanguage = "pl";
    visitor({ routeLocale: "en" });
    expect(await resolveDocumentLanguage()).toBe("en");
    visitor({ routeLocale: "pl", cookie: "en" });
    expect(await resolveDocumentLanguage()).toBe("pl");
  });

  it("on a bare path uses the viewer's language", async () => {
    visitor({ country: "PL" });
    expect(await resolveDocumentLanguage()).toBe("pl");
    visitor({ acceptLanguage: "en" });
    expect(await resolveDocumentLanguage()).toBe("en");
  });

  it("ignores an unknown route locale value", async () => {
    visitor({ routeLocale: "xx", cookie: "pl" });
    expect(await resolveDocumentLanguage()).toBe("pl");
  });
});

describe("languageFromCountry", () => {
  it.each([
    ["PL", "pl"],
    ["pl", "pl"],
    [" PL ", "pl"],
    ["US", null],
    ["GB", null],
    ["XX", null],
    ["T1", null],
    ["", null],
    [null, null],
  ])("%s -> %s", (country, expected) => {
    expect(languageFromCountry(country)).toBe(expected);
  });
});

describe("languageFromAcceptLanguage", () => {
  it.each([
    ["pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7", "pl"],
    ["en-US,en;q=0.9,pl;q=0.8", "en"],
    ["de-DE,de;q=0.9,pl;q=0.8,en;q=0.7", "de"],
    ["de-DE,de;q=0.9,en;q=0.8,pl;q=0.7", "de"],
    ["ja,ko;q=0.9,en;q=0.8", "en"],
    ["ja,ko", null],
    ["zh-TW,zh;q=0.9", "zh"],
    ["pt-PT,pt;q=0.9", "pt"],
    ["pl;q=0.5,en;q=0.9", "en"],
    ["en;q=0,pl;q=0.1", "pl"],
    ["PL", "pl"],
    ["fr-FR, de", "fr"],
    ["*", null],
    ["", null],
    [null, null],
  ])("%s -> %s", (header, expected) => {
    expect(languageFromAcceptLanguage(header)).toBe(expected);
  });
});
