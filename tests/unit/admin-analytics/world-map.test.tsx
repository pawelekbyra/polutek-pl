/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorldOverview } from "@/lib/modules/admin-analytics";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { WORLD_HEIGHT, WORLD_POINTS, WORLD_REGIONS, WORLD_SHAPES, WORLD_UNMAPPED, WORLD_WIDTH } from "@admin/components/analytics/world/geo.generated";
import { WorldMap, type MapCountry } from "@admin/components/analytics/world/world-map";
import { anchorOf } from "@admin/components/analytics/world/world-svg";
import { WorldTab } from "@admin/components/analytics/world/world-tab";

afterEach(() => cleanup());

describe("generated world geometry", () => {
  it("draws every ISO country as an outline or a point, with Cloudflare's codes", () => {
    const shapeCodes = WORLD_SHAPES.map((s) => s.code);
    for (const c of shapeCodes) expect(c).toMatch(/^[A-Z]{2}$/);
    // Natural Earth splits two countries; both halves carry the code Cloudflare reports.
    const dup = shapeCodes.filter((c, i) => shapeCodes.indexOf(c) !== i).sort();
    expect(dup).toEqual(["CY", "SO"]);
    for (const code of ["PL", "UA", "RU", "US", "XK", "TW", "EH", "LU"]) expect(shapeCodes).toContain(code);
    const pointCodes = WORLD_POINTS.map((p) => p.code);
    for (const code of ["MT", "SG", "AD", "MC", "VA", "GI", "RE"]) expect(pointCodes).toContain(code);
    for (const p of pointCodes) expect(shapeCodes).not.toContain(p);
    expect(new Set(pointCodes).size).toBe(pointCodes.length);
    expect(WORLD_UNMAPPED).toEqual(["AQ"]);
  });

  it("keeps every point and anchor inside the frame, and region boxes sane", () => {
    for (const p of WORLD_POINTS) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT);
    }
    const pl = anchorOf("PL");
    expect(pl).not.toBeNull();
    const europe = WORLD_REGIONS.find((r) => r.id === "europe")!;
    const [x, y, w, h] = europe.box;
    expect(pl![0]).toBeGreaterThan(x);
    expect(pl![0]).toBeLessThan(x + w);
    expect(pl![1]).toBeGreaterThan(y);
    expect(pl![1]).toBeLessThan(y + h);
    for (const r of WORLD_REGIONS) expect(r.box[2] / r.box[3]).toBeCloseTo(WORLD_WIDTH / WORLD_HEIGHT, 1);
  });
});

const overview: WorldOverview = {
  rangeLabel: "ostatnie 7 dni",
  compareLabel: "vs poprzednie 7 dni",
  freshness: { rollupAt: "2026-10-05T09:55:00Z", firstDay: "2026-09-01", coverageDays: 35 },
  kpis: [{ key: "countries", label: "Kraje z ruchem", value: 3, previous: 1, format: "int", upIsGood: true }],
  countries: [
    { code: "PL", name: "Polska", visitors: 50, pageviews: 120, share: 90.9, cls: 3, firstDay: "2026-09-01", isNew: false },
    { code: "DE", name: "Niemcy", visitors: 4, pageviews: 5, share: 7.3, cls: 2, firstDay: "2026-09-10", isNew: false },
    { code: "MT", name: "Malta", visitors: 1, pageviews: 1, share: 1.8, cls: 1, firstDay: "2026-10-04", isNew: true },
    { code: "FR", name: "Francja", visitors: 0, pageviews: 0, share: 0, cls: 0, firstDay: "2026-09-12", isNew: false },
  ],
  classes: [{ cls: 1, label: "1" }, { cls: 2, label: "2–4" }, { cls: 3, label: "5+" }],
  unknownVisitors: 2,
  conquest: [
    { day: "2026-09-01", label: "1 wrz 2026", codes: ["PL"], names: ["Polska"], total: 1 },
    { day: "2026-09-10", label: "10 wrz 2026", codes: ["DE"], names: ["Niemcy"], total: 2 },
    { day: "2026-09-12", label: "12 wrz 2026", codes: ["FR"], names: ["Francja"], total: 3 },
    { day: "2026-10-04", label: "4 paź 2026", codes: ["MT"], names: ["Malta"], total: 4 },
  ],
  conquestSeries: { labels: ["1 wrz", "2 wrz"], current: [1, 1], previous: null },
  notes: ["Kraj pochodzi z nagłówka Cloudflare."],
};

describe("WorldTab (server markup)", () => {
  it("renders the map, the points of small countries and the table without any inline style (strict CSP)", () => {
    const html = renderToStaticMarkup(<WorldTab d={overview} cmp now={new Date("2026-10-05T10:00:00Z")} />);
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).toMatch(/<path class="wm-country wm-c3" d="[^"]+" data-code="PL"/);
    expect(html).toMatch(/<circle class="wm-country wm-point wm-c1"[^>]*data-code="MT"/);
    // Small countries without data get no point (no clutter); FR is an outline with class 0.
    expect(html).not.toMatch(/<circle[^>]*data-code="SG"/);
    expect(html).toMatch(/<path class="wm-country wm-c0" d="[^"]+" data-code="FR"/);
    expect(html).toContain("Tabela krajów (4)");
    expect(html).toContain("Nieznany kraj");
    expect(html).toContain("Kamienie milowe");
  });
});

const mapCountries: MapCountry[] = overview.countries.map((c) => ({ ...c, firstLabel: overview.conquest.find((s) => s.day === c.firstDay)?.label ?? null, anchor: anchorOf(c.code) }));
const renderMap = () =>
  render(
    <WorldMap countries={mapCountries} classes={overview.classes} steps={overview.conquest.map((c) => ({ ...c, totalLabel: `${c.total} kraje` }))} regions={WORLD_REGIONS} width={WORLD_WIDTH} height={WORLD_HEIGHT} pointRadius={2.6} rangeLabel="ostatnie 7 dni" unknownVisitors={2}>
      <svg className="wm-svg" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}>
        <path className="wm-country wm-c3" data-code="PL" d="M0,0" />
        <path className="wm-country wm-c0" data-code="FR" d="M0,0" />
        <circle className="wm-country wm-point wm-c1" data-code="MT" cx="1" cy="1" r="2.6" />
      </svg>
    </WorldMap>,
  );

describe("WorldMap (interactive layer)", () => {
  it("walks the countries by visitors with the keyboard, pins one with Enter and clears with Escape", () => {
    renderMap();
    const frame = screen.getByRole("group", { name: /Mapa świata/ });
    expect(frame).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(frame, { key: "ArrowRight" });
    expect(screen.getByText(/Polska: 50 odwiedzających/)).toBeInTheDocument();
    expect(document.querySelector('[data-code="PL"]')).toHaveClass("is-active");
    fireEvent.keyDown(frame, { key: "ArrowRight" });
    expect(screen.getByText(/Niemcy: 4 odwiedzających/)).toBeInTheDocument();
    fireEvent.keyDown(frame, { key: "Enter" });
    expect(screen.getByRole("heading", { name: "Niemcy" })).toBeInTheDocument();
    fireEvent.keyDown(frame, { key: "Escape" });
    expect(screen.queryByRole("heading", { name: "Niemcy" })).not.toBeInTheDocument();
  });

  it("pins a country on click and shows a country without visitors honestly", () => {
    renderMap();
    fireEvent.click(document.querySelector('[data-code="FR"]')!);
    expect(screen.getByRole("heading", { name: "Francja" })).toBeInTheDocument();
    expect(screen.getByText("brak w okresie")).toBeInTheDocument();
    expect(document.querySelector('[data-code="FR"]')).toHaveClass("is-selected");
    expect(screen.getByText(/Nieznany kraj \(VPN, Tor\): 2/)).toBeInTheDocument();
  });

  it("replays the conquest: countries light up on the day they were first seen", () => {
    vi.useFakeTimers();
    try {
      renderMap();
      fireEvent.click(screen.getByRole("button", { name: "Podbój świata" }));
      const slider = screen.getByLabelText("Dzień podboju");
      fireEvent.change(slider, { target: { value: "1" } });
      expect(document.querySelector('[data-code="PL"]')).toHaveClass("is-on");
      expect(document.querySelector('[data-code="FR"]')).not.toHaveClass("is-on");
      expect(screen.getByText(/nowe: Niemcy/)).toBeInTheDocument();
      fireEvent.change(slider, { target: { value: "2" } });
      expect(document.querySelector('[data-code="FR"]')).toHaveClass("is-fresh");
      fireEvent.click(screen.getByRole("button", { name: "Odtwórz" }));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(document.querySelector('[data-code="MT"]')).toHaveClass("is-fresh");
      expect(screen.getByRole("button", { name: "Odtwórz od początku" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("zooms to a region by changing the viewBox only", () => {
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      renderMap();
      fireEvent.click(screen.getByRole("button", { name: "Europa" }));
      const europe = WORLD_REGIONS.find((r) => r.id === "europe")!;
      expect(document.querySelector("svg.wm-svg")?.getAttribute("viewBox")).toBe(europe.box.map((v) => v.toFixed(1)).join(" "));
      expect(screen.getByRole("button", { name: "Europa" })).toHaveAttribute("aria-pressed", "true");
      expect(Number(document.querySelector("circle")?.getAttribute("r"))).toBeLessThan(2.6);
    } finally {
      window.matchMedia = mm;
    }
  });
});
