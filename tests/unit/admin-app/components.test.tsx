/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));

import { ColumnChart, niceMax } from "@admin/components/column-chart";
import { Age, Badge, Delta, Meter, Spark, State, Tile } from "@admin/components/ui";
import { OtpInput } from "@admin/components/auth/otp-input";
import { matches, normalize } from "@admin/components/shell/command-palette";

afterEach(() => cleanup());

const chart = (
  <ColumnChart title="Napiwki" summary="Razem 30 zł" labels={["pon", "wt", "śr"]} values={[10, 0, 20]} seriesName="Napiwki netto" xName="Dzień" format="pln" />
);

describe("ColumnChart", () => {
  it("is keyboard-readable and announces the value under the cursor", () => {
    render(chart);
    const plot = screen.getByRole("group", { name: /Napiwki: wykres słupkowy/ });
    expect(plot).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    expect(screen.getByText("pon: 10 zł")).toBeInTheDocument();
    fireEvent.keyDown(plot, { key: "End" });
    expect(screen.getByText("śr: 20 zł")).toBeInTheDocument();
    fireEvent.keyDown(plot, { key: "Escape" });
    expect(screen.queryByText("śr: 20 zł")).not.toBeInTheDocument();
  });

  it("always ships a real data table and a summary", () => {
    render(chart);
    expect(screen.getByRole("table", { name: "Napiwki" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "wt" })).toBeInTheDocument();
    expect(screen.getByText("Razem 30 zł")).toBeInTheDocument();
  });

  it("uses round axis steps", () => {
    expect(niceMax(26.25)).toBe(32);
    expect(niceMax(0)).toBe(4);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(105)).toBe(120);
  });
});

describe("CSP-safe markup", () => {
  it("renders charts, meters and tiles without a single inline style attribute", () => {
    const html = renderToStaticMarkup(
      <>
        {chart}
        <Meter percent={64} label="Dysk" valueText="46 GB z 75 GB" warnAt={80} critAt={90} />
        <Tile label="Napiwki" value="32" unit="zł" spark={[1, 3, 2, 5]} delta={<Delta current={150} previous={100} upIsGood context="vs tydzień temu" />} />
      </>,
    );
    expect(html).not.toMatch(/\sstyle="/);
  });
});

describe("state atoms", () => {
  it("never carries state by colour alone", () => {
    render(
      <>
        <State kind="crit" />
        <Badge kind="warn">Uwaga</Badge>
      </>,
    );
    expect(screen.getByText("Błąd")).toBeInTheDocument();
    expect(screen.getByText("Uwaga")).toBeInTheDocument();
  });

  it("speaks deltas, including whether they are good", () => {
    render(<Delta current={80} previous={100} upIsGood={false} context="vs tydzień temu" />);
    expect(screen.getByText("spadek o 20% (korzystnie)")).toBeInTheDocument();
  });

  it("explains a comparison against zero in words", () => {
    render(<Delta current={3} previous={0} upIsGood context="vs tydzień temu" />);
    expect(screen.getByText("vs tydzień temu: było 0")).toBeInTheDocument();
  });

  it("exposes the meter value to assistive tech", () => {
    render(<Meter percent={36} label="Swap" valueText="1,4 GB z 4 GB" warnAt={25} critAt={60} />);
    const m = screen.getByRole("meter", { name: "Swap" });
    expect(m).toHaveAttribute("aria-valuenow", "36");
    expect(m).toHaveAttribute("aria-valuetext", "1,4 GB z 4 GB");
    expect(m).toHaveClass("meter-warn");
  });

  it("marks data older than twice the interval as stale", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    const { rerender } = render(<Age at="2026-10-04T11:59:00Z" everyMin={1} now={now} />);
    expect(screen.getByText(/dane z/)).not.toHaveClass("stale");
    rerender(<Age at="2026-10-04T11:50:00Z" everyMin={1} now={now} />);
    expect(screen.getByText(/nieaktualne/)).toHaveClass("stale");
    rerender(<Age at={null} everyMin={1} now={now} />);
    expect(screen.getByText("brak pomiaru")).toBeInTheDocument();
  });

  it("draws a sparkline only from two points", () => {
    expect(renderToStaticMarkup(<Spark values={[1]} />)).toBe("");
    expect(renderToStaticMarkup(<Spark values={[1, 2]} />)).toContain('aria-hidden="true"');
  });
});

describe("OtpInput", () => {
  it("fills all six boxes from a pasted code and completes", () => {
    const onComplete = vi.fn();
    function Harness() {
      const [v, setV] = React.useState("");
      return <OtpInput value={v} onChange={setV} onComplete={onComplete} labelledBy="x" />;
    }
    render(<Harness />);
    const first = screen.getByLabelText("Cyfra 1 z 6");
    fireEvent.paste(first, { clipboardData: { getData: () => "12 34 56" } });
    expect(onComplete).toHaveBeenCalledWith("123456");
    expect(screen.getByLabelText("Cyfra 6 z 6")).toHaveValue("6");
  });
});

describe("command palette search", () => {
  it("ignores Polish diacritics and matches every word", () => {
    expect(normalize("Społeczność Łódź")).toBe("spolecznosc lodz");
    expect(matches({ label: "Społeczność", group: "Przejdź" }, "spolecz")).toBe(true);
    expect(matches({ label: "Przełącz motyw", group: "Akcje", keywords: "ciemny jasny" }, "motyw ciemny")).toBe(true);
    expect(matches({ label: "System", group: "Przejdź" }, "zwrot")).toBe(false);
  });
});
