import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: new Headers(),
  headersThrow: false,
  negotiated: "de" as string,
}));

vi.mock("next/headers", () => ({
  headers: async () => {
    if (h.headersThrow) throw new Error("outside a request scope");
    return h.headers;
  },
}));
vi.mock("@/lib/i18n/server-language", () => ({ resolveDocumentLanguage: async () => h.negotiated }));

import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { ROUTE_LOCALE_HEADER } from "@/lib/i18n/routing";

beforeEach(() => {
  h.headers = new Headers();
  h.headersThrow = false;
  h.negotiated = "de";
});

describe("resolvePageLocale (W01: one language per response)", () => {
  it("a bare address (proxy rewrote it to the /pl placeholder, no route locale) gets the negotiated language", async () => {
    expect(await resolvePageLocale("pl")).toBe("de");
    h.negotiated = "en";
    expect(await resolvePageLocale("pl")).toBe("en");
  });

  it("an address that names its language keeps it, whatever the cookie or account say", async () => {
    h.headers.set(ROUTE_LOCALE_HEADER, "pl");
    expect(await resolvePageLocale("pl")).toBe("pl");
    h.headers.set(ROUTE_LOCALE_HEADER, "fr");
    expect(await resolvePageLocale("fr")).toBe("fr");
  });

  it("agrees with the layout for every language: the layout's resolver is the one source", async () => {
    for (const language of ["pl", "en", "de", "es", "fr", "it", "pt", "zh"]) {
      h.negotiated = language;
      expect(await resolvePageLocale("pl")).toBe(language);
    }
  });

  it("is not a language: null (the page answers 404)", async () => {
    expect(await resolvePageLocale("xx")).toBeNull();
    expect(await resolvePageLocale("")).toBeNull();
  });

  it("a non-placeholder segment without the header is taken as written", async () => {
    expect(await resolvePageLocale("en")).toBe("en");
  });

  it("outside a request (a unit test rendering the page) returns the segment", async () => {
    h.headersThrow = true;
    expect(await resolvePageLocale("pl")).toBe("pl");
    expect(await resolvePageLocale("de")).toBe("de");
  });
});
