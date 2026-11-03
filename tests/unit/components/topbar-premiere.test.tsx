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

import TopbarPremiere, { TopbarPremiereSpacer, formatPremiereDate, isTopbarPremiereActive } from "@/app/components/TopbarPremiere";

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
    expect(nav).toMatch(/<\/BrandHomeLink>\s*<\/div>\s*<TopbarPremiere \/>/);
  });

  it("sits in a flexible, centred zone between the logo and the search box, with an empty twin after the search box", () => {
    const nav = readFileSync(path.join(process.cwd(), "app/components/Navbar.tsx"), "utf8");
    // order in the bar: logo, note zone, desktop search, spacer, right controls
    const order = ["<BrandHomeLink", "<TopbarPremiere />", "{/* Desktop search */}", "<TopbarPremiereSpacer />", "{/* Right controls */}"].map((m) => nav.indexOf(m));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // the search box keeps 548px when the note is shown from 1180px
    expect(nav).toContain("min-[1180px]:w-[548px]");

    render(<TopbarPremiere />);
    const zone = screen.getByTestId("topbar-premiere-zone");
    const cls = zone.className.split(/\s+/);
    for (const c of ["flex", "flex-1", "items-center", "justify-center", "-mr-[9px]", "md:-mr-2", "max-[360px]:hidden", "md:max-[1180px]:hidden", "md:min-w-max"]) {
      expect(cls).toContain(c);
    }
    expect(zone.querySelector('[data-testid="topbar-premiere"]')).not.toBeNull();
  });

  it("the spacer exists only while the note is configured", () => {
    expect(isTopbarPremiereActive(null)).toBe(false);
    expect(isTopbarPremiereActive({ date: "bad" })).toBe(false);
    expect(isTopbarPremiereActive({ date: "2027-01-01" })).toBe(true);
    expect(render(<TopbarPremiereSpacer premiere={null} />).container.innerHTML).toBe("");
    cleanup();
    expect(render(<TopbarPremiereSpacer />).container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
