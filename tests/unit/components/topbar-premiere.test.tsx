/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTx } from "@/lib/i18n/ui";
import { loadCatalog } from "@/lib/i18n/catalog";
import { UI_ONLY_LOCALES } from "@/lib/i18n/routing";
import { TOPBAR_PREMIERE } from "@/lib/ui-flags";

let currentTx = createTx("pl", null);
vi.mock("@/app/components/LanguageContext", () => ({
  useLanguage: () => ({ tx: currentTx, language: currentTx.language }),
}));

import TopbarPremiere, { formatPremiereDate } from "@/app/components/TopbarPremiere";

describe("TopbarPremiere", () => {
  afterEach(() => {
    cleanup();
    currentTx = createTx("pl", null);
  });

  it("is configured in one place: lib/ui-flags.ts, 2027-01-01", () => {
    expect(TOPBAR_PREMIERE).toEqual({ date: "2027-01-01" });
  });

  it("renders the Polish text with the dd.mm.yyyy date and a final dot", () => {
    render(<TopbarPremiere />);
    expect(screen.getByTestId("topbar-premiere").textContent).toBe("PREMIERA: 01.01.2027.");
  });

  it("renders English text", () => {
    currentTx = createTx("en", null);
    render(<TopbarPremiere />);
    expect(screen.getByTestId("topbar-premiere").textContent).toBe("PREMIERE: 01.01.2027.");
  });

  it("renders nothing when the config is null or the date is malformed", () => {
    const a = render(<TopbarPremiere premiere={null} />);
    expect(a.container.innerHTML).toBe("");
    const b = render(<TopbarPremiere premiere={{ date: "01/01/2027" }} />);
    expect(b.container.innerHTML).toBe("");
  });

  it("is plain accessible text: not a link, not focusable, not aria-hidden, no pointer events", () => {
    render(<TopbarPremiere />);
    const el = screen.getByTestId("topbar-premiere");
    expect(el.tagName).toBe("P");
    expect(el.closest("a,button")).toBeNull();
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(el.getAttribute("aria-hidden")).toBeNull();
    const css = readFileSync(path.join(process.cwd(), "app/components/TopbarPremiere.module.css"), "utf8");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("font-display: swap");
  });

  it("formats ISO dates as dd.mm.yyyy", () => {
    expect(formatPremiereDate("2027-01-01")).toBe("01.01.2027");
    expect(formatPremiereDate("2027-12-31")).toBe("31.12.2027");
    expect(formatPremiereDate("nonsense")).toBeNull();
  });

  it.each(UI_ONLY_LOCALES)("has a translation with the date placeholder in the %s catalog", async (locale) => {
    const catalog = await loadCatalog(locale);
    expect(catalog?.["PREMIERE: {0}."]).toMatch(/\{0\}/);
    currentTx = createTx(locale, catalog);
    render(<TopbarPremiere />);
    expect(screen.getByTestId("topbar-premiere").textContent).toContain("01.01.2027");
  });

  it("is placed in the Navbar next to the logo, outside the logo link", () => {
    const nav = readFileSync(path.join(process.cwd(), "app/components/Navbar.tsx"), "utf8");
    expect(nav).toMatch(/<\/BrandHomeLink>\s*<TopbarPremiere \/>/);
  });
});
