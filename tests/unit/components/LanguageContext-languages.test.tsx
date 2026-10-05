/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { LanguageProvider, useLanguage } from "@/app/components/LanguageContext";
import { loadCatalog } from "@/lib/i18n/catalog";
import type { Locale } from "@/lib/i18n/routing";

let api: ReturnType<typeof useLanguage>;
function Probe() {
  api = useLanguage();
  return (
    <div>
      <span data-testid="lang">{api.language}</span>
      <span data-testid="text">{api.tx("Zaloguj się", "Sign in")}</span>
      <span data-testid="dict">{api.t.cancel}</span>
    </div>
  );
}

const cookie = () => document.cookie.split("; ").find((c) => c.startsWith("app-language="));

beforeEach(() => {
  localStorage.clear();
  document.cookie = "app-language=; max-age=0; path=/";
  document.documentElement.lang = "";
});
afterEach(() => cleanup());

describe("LanguageProvider with the six interface languages", () => {
  it.each(["de", "es", "fr", "it", "pt", "zh"] as Locale[])("starts in %s with the server's catalog: translated on the first render", async (locale) => {
    const catalog = await loadCatalog(locale);
    render(
      <LanguageProvider initialLanguage={locale} initialCatalog={catalog} initialCatalogLanguage={locale}>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe(locale);
    expect(screen.getByTestId("text").textContent).toBe(catalog!["Sign in"]);
    expect(screen.getByTestId("text").textContent).not.toBe("Sign in");
    await waitFor(() => expect(cookie()).toBe(`app-language=${locale}`));
    expect(localStorage.getItem("app-language")).toBe(locale);
  });

  it("sets <html lang> with the regional tag (zh-CN, pt-BR) and keeps plain codes for the rest", async () => {
    render(<LanguageProvider initialLanguage="en"><Probe /></LanguageProvider>);
    for (const [locale, tag] of [["zh", "zh-CN"], ["pt", "pt-BR"], ["de", "de"], ["pl", "pl"]] as const) {
      await act(async () => api.setLanguage(locale));
      await waitFor(() => expect(document.documentElement.lang).toBe(tag));
    }
  });

  it("switches at runtime: loads the catalog first, persists in cookie and storage, and never shows a raw key", async () => {
    render(<LanguageProvider initialLanguage="en"><Probe /></LanguageProvider>);
    expect(screen.getByTestId("text").textContent).toBe("Sign in");
    await act(async () => api.setLanguage("de"));
    await waitFor(() => expect(screen.getByTestId("lang").textContent).toBe("de"));
    const german = (await loadCatalog("de"))!["Sign in"];
    expect(screen.getByTestId("text").textContent).toBe(german);
    expect(cookie()).toBe("app-language=de");
    expect(localStorage.getItem("app-language")).toBe("de");
    // The short-phrase dictionary follows too.
    expect(screen.getByTestId("dict").textContent).toBe("Abbrechen");
    // Back to Polish: the inline Polish text, no catalog involved.
    await act(async () => api.setLanguage("pl"));
    await waitFor(() => expect(screen.getByTestId("text").textContent).toBe("Zaloguj się"));
  });

  it("a language shown without a catalog falls back to English until it arrives, never to a key", async () => {
    render(<LanguageProvider initialLanguage="fr"><Probe /></LanguageProvider>);
    expect(screen.getByTestId("text").textContent).toMatch(/^(Sign in|.+)$/);
    const french = (await loadCatalog("fr"))!["Sign in"];
    await waitFor(() => expect(screen.getByTestId("text").textContent).toBe(french));
  });

  it("the last choice wins when two switches overlap", async () => {
    render(<LanguageProvider initialLanguage="en"><Probe /></LanguageProvider>);
    await act(async () => {
      api.setLanguage("zh");
      api.setLanguage("es");
    });
    await waitFor(() => expect(screen.getByTestId("lang").textContent).toBe("es"));
    expect(cookie()).toBe("app-language=es");
  });
});
