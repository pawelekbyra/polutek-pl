import { afterEach, describe, expect, it, vi } from "vitest";
import { SUPPORTED_LOCALES, getLocalizedHref, switchLocalePath } from "@/lib/i18n/routing";
import {
  SECTION_BAR_STORAGE_KEY,
  readHiddenPreference,
  sectionFromSegments,
  writeHiddenPreference,
} from "@/lib/sections/sections";
import { addToCart } from "@/lib/sections/demo-shop";

describe("section routes", () => {
  it("has photos and shop addresses in every language", () => {
    expect(getLocalizedHref("pl", "photos")).toBe("/zdjecia");
    expect(getLocalizedHref("pl", "shop")).toBe("/sklep");
    expect(getLocalizedHref("en", "photos")).toBe("/en/photos");
    expect(getLocalizedHref("en", "shop")).toBe("/en/shop");
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "pl" && l !== "en")) {
      expect(getLocalizedHref(locale, "photos")).toBe(`/${locale}/photos`);
      expect(getLocalizedHref(locale, "shop")).toBe(`/${locale}/shop`);
    }
  });

  it("keeps the section when the language is switched", () => {
    expect(switchLocalePath("/zdjecia", "en")).toBe("/en/photos");
    expect(switchLocalePath("/en/shop", "pl")).toBe("/sklep");
  });
});

describe("sectionFromSegments", () => {
  it("maps routes to sections and hides the navigation elsewhere", () => {
    expect(sectionFromSegments(["pl"])).toBe("video");
    expect(sectionFromSegments(["pl", "(home)"])).toBe("video");
    expect(sectionFromSegments(["en", "watch", "x"])).toBe("video");
    expect(sectionFromSegments(["pl", "zdjecia"])).toBe("photos");
    expect(sectionFromSegments(["de", "photos"])).toBe("photos");
    expect(sectionFromSegments(["pl", "sklep"])).toBe("shop");
    expect(sectionFromSegments(["en", "shop"])).toBe("shop");
    expect(sectionFromSegments(["pl", "studio"])).toBeNull();
    expect(sectionFromSegments(["en", "terms"])).toBeNull();
    expect(sectionFromSegments(["pl", "regulamin"])).toBeNull();
    expect(sectionFromSegments(["admin"])).toBeNull();
  });
});

describe("hidden preference", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers the choice and survives missing storage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    });
    expect(readHiddenPreference(SECTION_BAR_STORAGE_KEY)).toBe(false);
    writeHiddenPreference(SECTION_BAR_STORAGE_KEY, true);
    expect(readHiddenPreference(SECTION_BAR_STORAGE_KEY)).toBe(true);
    writeHiddenPreference(SECTION_BAR_STORAGE_KEY, false);
    expect(readHiddenPreference(SECTION_BAR_STORAGE_KEY)).toBe(false);

    vi.stubGlobal("window", { get localStorage(): never { throw new Error("blocked"); } });
    expect(readHiddenPreference(SECTION_BAR_STORAGE_KEY)).toBe(false);
    expect(() => writeHiddenPreference(SECTION_BAR_STORAGE_KEY, true)).not.toThrow();
  });
});

describe("demo cart", () => {
  it("merges the same product and size", () => {
    const once = addToCart([], { productId: "a", size: "M", qty: 1 });
    expect(addToCart(once, { productId: "a", size: "M", qty: 2 })).toEqual([{ productId: "a", size: "M", qty: 3 }]);
    expect(addToCart(once, { productId: "a", size: "L", qty: 1 })).toHaveLength(2);
  });
});

describe("flag SHOW_SECTION_NAV off", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/ui-flags");
    vi.doUnmock("next/navigation");
  });

  it("makes the section pages answer 404 and hides the navigation", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ui-flags", () => ({ SHOW_SECTION_NAV: false }));
    vi.doMock("next/navigation", () => ({
      notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
      },
      useSelectedLayoutSegments: () => ["pl", "zdjecia"],
    }));
    const { ensureSectionsEnabled } = await import("@/lib/sections/sections");
    expect(() => ensureSectionsEnabled()).toThrow("NEXT_NOT_FOUND");
    const { default: SectionNav } = await import("@/app/components/sections/SectionNav");
    expect(SectionNav()).toBeNull();
  });

  it("is on by default in the repository", async () => {
    const { SHOW_SECTION_NAV } = await import("@/lib/ui-flags");
    expect(SHOW_SECTION_NAV).toBe(true);
  });
});
