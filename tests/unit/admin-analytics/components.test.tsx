/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveSnapshot } from "@/lib/modules/admin-analytics";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { BarList, KpiTiles, SeriesChart } from "@admin/components/analytics/parts";
import { isSnapshot, LiveMonitor } from "@admin/components/analytics/live-monitor";
import { TrendChart } from "@admin/components/analytics/trend-chart";
import { formatValue } from "@admin/components/analytics/format";

afterEach(() => cleanup());

const labels = ["pon", "wt", "śr", "czw"];
const chart = (over: Partial<React.ComponentProps<typeof TrendChart>> = {}) => (
  <TrendChart
    title="Odwiedzający"
    summary="Unikalni odwiedzający na dobę"
    labels={labels}
    series={[
      { name: "Poprzedni okres", values: [5, 6, 7, 8], role: "compare" },
      { name: "Odwiedzający", values: [10, null, 30, 20], role: "current" },
    ]}
    format="int"
    xName="Doba"
    {...over}
  />
);

describe("TrendChart", () => {
  it("is keyboard-readable and says 'bez pomiaru' for a missing bucket instead of 0", () => {
    render(chart());
    const plot = screen.getByRole("group", { name: /Odwiedzający: wykres liniowy/ });
    expect(plot).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    expect(screen.getByText("pon. Poprzedni okres: 5; Odwiedzający: 10".replace("pon. ", "pon. "))).toBeInTheDocument();
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    expect(screen.getByText(/wt\. Poprzedni okres: 6; Odwiedzający: bez pomiaru/)).toBeInTheDocument();
    fireEvent.keyDown(plot, { key: "Escape" });
    expect(screen.queryByText(/Odwiedzający: bez pomiaru/)).not.toBeInTheDocument();
  });

  it("ships a real data table with every series and a legend for two series", () => {
    render(chart());
    const table = screen.getByRole("table", { name: "Odwiedzający" });
    expect(table).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Doba", "Poprzedni okres", "Odwiedzający"]);
    expect(screen.getByRole("rowheader", { name: "wt" }).closest("tr")).toHaveTextContent("bez pomiaru");
    expect(screen.getByRole("list", { name: "Legenda" })).toBeInTheDocument();
    expect(screen.getByText("Unikalni odwiedzający na dobę")).toBeInTheDocument();
  });

  it("lists annotations from the change timeline both as markers and as text", () => {
    render(chart({ annotations: [{ index: 2, when: "dziś, 08:00", label: "Wdrożenie: abc" }] }));
    expect(screen.getByRole("list", { name: "Adnotacje: co się zmieniło" })).toHaveTextContent("dziś, 08:00 · Wdrożenie: abc");
    expect(screen.getByText("Adnotacja 1:")).toBeInTheDocument();
  });

  it("shows 'bez pomiaru' instead of an empty plot when nothing was measured", () => {
    render(chart({ series: [{ name: "Odwiedzający", values: [null, null, null, null], role: "current" }] }));
    expect(screen.getAllByText("bez pomiaru").length).toBeGreaterThan(0);
  });

  it("renders the band, reference line and never an inline style attribute (strict CSP)", () => {
    const html = renderToStaticMarkup(chart({ band: { name: "Typowy film", lo: [1, 2, 3, 4], hi: [5, 6, 7, 8] }, refLine: { value: 15, label: "cel" }, annotations: [{ index: 1, when: "x", label: "y" }] }));
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).toContain("trend-band");
    expect(html).toContain("trend-ref");
    expect(html).toContain("Typowy film (od–do)");
  });
});

describe("KpiTiles and BarList", () => {
  it("renders 'bez pomiaru' for a null value, never a zero, and a delta only with a previous value", () => {
    const html = renderToStaticMarkup(
      <KpiTiles
        label="Ruch"
        compare
        context="vs poprzednie 7 dni"
        kpis={[
          { key: "a", label: "Odwiedzający", value: null, previous: 5, format: "int", upIsGood: true },
          { key: "b", label: "Odsłony", value: 120, previous: 100, format: "int", upIsGood: true },
        ]}
      />,
    );
    expect(html).toContain("bez pomiaru");
    expect(html).not.toMatch(/>0</);
    expect(html).toContain("wzrost o 20%");
    expect(html).not.toMatch(/\sstyle=/);
  });

  it("draws bars by percent classes and says so when empty", () => {
    const html = renderToStaticMarkup(<BarList items={[{ label: "google.com", value: 70, share: 35 }]} />);
    expect(html).toContain("pw-35");
    expect(html).toContain("70 · 35%");
    expect(renderToStaticMarkup(<BarList items={[]} />)).toContain("Bez pomiaru");
  });

  it("SeriesChart omits the comparison series when comparison is off", () => {
    const html = renderToStaticMarkup(<SeriesChart title="t" summary="s" series={{ labels: ["a", "b"], current: [1, 2], previous: null }} format="int" xName="x" name="Teraz" />);
    expect(html).not.toContain("Poprzedni okres");
  });

  it("formats values by kind", () => {
    expect(formatValue(1234, "int")).toBe("1234");
    expect(formatValue(12345, "int").replace(/\s/g, " ")).toBe("12 345");
    expect(formatValue(1.5, "sec")).toBe("1,5 s");
    expect(formatValue(12.34, "pct")).toBe("12,3%");
  });
});

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, ((e: MessageEvent<string>) => void)[]>();
  closed = false;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: (e: MessageEvent<string>) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  close() {
    this.closed = true;
  }
  emit(name: string, data: unknown) {
    for (const fn of this.listeners.get(name) ?? []) fn({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
}

const snap = (over: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  at: "2026-10-05T10:00:00.000Z", videoId: "va", videoTitle: "Cześć", viewersNow: 42, viewersPeak: 50, startupP95Ms: 1800, startupN: 30, errorsLastMinute: 1,
  errorShare5mPct: 2, pageviewsLastMinute: 9, perMinute: [{ minute: "2026-10-05T09:59:00.000Z", viewers: 40, starts: 2, errors: 0, pageviews: 3 }], server: { cpuLoadPct: 30, memUsedPct: 50, swapUsedPct: 1 },
  tips: { count: 2, totalMinor: 3000, currency: "pln" }, comments: { count: 5 }, workerForecast: null, notes: [], ...over,
});

describe("LiveMonitor", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens the stream for the film and shows new snapshots", () => {
    render(<LiveMonitor initial={snap()} videoKey="va" />);
    const es = FakeEventSource.instances[0];
    expect(es.url).toBe("/api/live?video=va");
    expect(screen.getByText("42")).toBeInTheDocument();
    act(() => es.emit("snapshot", snap({ viewersNow: 77 })));
    expect(screen.getByText("77")).toBeInTheDocument();
    expect(screen.getAllByText(/na żywo, odświeżanie co kilka sekund/).length).toBeGreaterThan(0);
  });

  it("'Wstrzymaj' closes the stream (WCAG 2.2.2) and 'Wznów' opens a new one", () => {
    render(<LiveMonitor initial={snap()} videoKey="" />);
    const first = FakeEventSource.instances[0];
    expect(first.url).toBe("/api/live");
    const pause = screen.getByRole("button", { name: "Wstrzymaj odświeżanie" });
    expect(pause).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pause);
    expect(first.closed).toBe(true);
    expect(screen.getByRole("button", { name: "Wznów odświeżanie" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Wstrzymane")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wznów odświeżanie" }));
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("shows 'bez pomiaru' for missing numbers and closes the stream on unmount", () => {
    const { unmount } = render(<LiveMonitor initial={snap({ viewersNow: null, startupP95Ms: null, errorsLastMinute: null, errorShare5mPct: null, server: null, tips: null, comments: null })} videoKey="" />);
    expect(screen.getAllByText("bez pomiaru").length).toBeGreaterThanOrEqual(3);
    const es = FakeEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it("warns when the stream goes silent for 15 s", () => {
    vi.useFakeTimers();
    try {
      render(<LiveMonitor initial={snap()} videoKey="" />);
      act(() => void vi.advanceTimersByTime(20_000));
      expect(screen.getByText("od 15 s brak nowych danych")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts only well-formed snapshots", () => {
    expect(isSnapshot(snap())).toBe(true);
    expect(isSnapshot({ at: 1 })).toBe(false);
    expect(isSnapshot(null)).toBe(false);
  });

  it("renders without inline styles", () => {
    expect(renderToStaticMarkup(<LiveMonitor initial={snap({ workerForecast: { used: 90_000, limit: 100_000, reason: "x" } })} videoKey="" />)).not.toMatch(/\sstyle=/);
  });
});
