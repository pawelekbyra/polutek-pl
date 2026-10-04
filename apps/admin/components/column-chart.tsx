"use client";
/**
 * Column chart of the panel (DESIGN-SYSTEM.md 3-4): bars <= 24 px with rounded tops, hairline grid,
 * one Y axis, a tooltip that only complements, keyboard reading (arrows, Home, End) and a real data
 * table under every chart. Server-rendered at full width with CSS (no measuring, no skeleton);
 * heights and widths come from the percentage classes in scale.css, so the strict CSP needs no
 * inline styles. The tooltip is positioned through the CSSOM, which CSP allows.
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ColumnChartProps = {
  title: string;
  summary: string;
  labels: string[];
  values: number[];
  seriesName: string;
  xName: string;
  format: "int" | "pln";
  height?: 160 | 200 | 240;
};

const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const fmt = (v: number, f: ColumnChartProps["format"]) => (f === "pln" ? `${nf0.format(Math.round(v))} zł` : nf0.format(Math.round(v)));

/**
 * Top of the Y axis: four equal steps of a "round" size (1, 2, 2.5, 3, 4, 5, 6, 8 × 10^k, at least 1),
 * so every tick label is a whole, readable number (0, 8, 16, 24, 32 rather than 0, 6, 13, 19, 25).
 */
export function niceMax(v: number): number {
  const raw = Math.max(1, v / 4);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * p >= raw) ?? 10) * p;
  const whole = step < 1 ? 1 : step % 1 === 0 ? step : Math.ceil(step);
  return whole * 4;
}

export function ColumnChart({ title, summary, labels, values, seriesName, xName, format, height = 200 }: ColumnChartProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [active, setActive] = useState<number>(-1);
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const n = values.length;
  const max = niceMax(Math.max(0, ...values) * 1.05);
  const ticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const every = Math.max(1, Math.ceil(n / 7));

  function place(i: number) {
    const plot = plotRef.current;
    const tip = tipRef.current;
    if (!plot || !tip) return;
    const w = plot.clientWidth;
    const x = ((i + 0.5) / n) * w;
    const tw = tip.offsetWidth || 160;
    const left = x + 14 + tw > w - 4 ? x - tw - 14 : x + 14;
    tip.style.left = `${Math.max(4, left)}px`;
  }

  function show(i: number) {
    if (i < 0 || i >= n) return;
    setActive(i);
    requestAnimationFrame(() => place(i));
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
    if (i !== active) show(i);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = { ArrowRight: active < 0 ? 0 : Math.min(n - 1, active + 1), ArrowLeft: active < 0 ? n - 1 : Math.max(0, active - 1), Home: 0, End: n - 1 };
    if (e.key in map) {
      e.preventDefault();
      show(map[e.key]);
    } else if (e.key === "Escape") setActive(-1);
  }

  return (
    <figure className="chart">
      <div className={`cchart cchart-h-${height}`}>
        <div className="cchart-y" aria-hidden="true">
          <span className="gy-sizer">{fmt(max, format)}</span>
          {ticks.map((t, i) => (
            <span key={i} className={`gy-${i}`}>
              {fmt(t, format)}
            </span>
          ))}
        </div>
        <div
          ref={plotRef}
          className="cchart-plot"
          tabIndex={0}
          role="group"
          aria-label={`${title}: wykres słupkowy. Strzałki w lewo i prawo czytają wartości; pełne dane w tabeli pod wykresem.`}
          aria-describedby={`${id}-cap`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(-1)}
          onBlur={() => setActive(-1)}
          onKeyDown={onKeyDown}
        >
          {[1, 2, 3, 4].map((g) => (
            <span key={g} className={`cchart-grid gy-${g}`} aria-hidden="true" />
          ))}
          <div className="cchart-bars" aria-hidden="true">
            {values.map((v, i) => {
              const pct = Math.round((Math.max(0, v) / max) * 100);
              return (
                <div key={i} className={`cchart-col${i === active ? " is-hover" : ""}`}>
                  <div className={`cchart-bar${v <= 0 ? " is-zero" : ` ph-${Math.max(1, Math.min(100, pct))}`}`} />
                </div>
              );
            })}
          </div>
          <div ref={tipRef} className="chart-tip" hidden={active < 0} aria-hidden="true">
            {active >= 0 ? (
              <>
                <div className="tip-title">{labels[active]}</div>
                <div className="tip-row">
                  <span className="tip-key" />
                  <strong>{fmt(values[active], format)}</strong>
                  <span>{seriesName}</span>
                </div>
              </>
            ) : null}
          </div>
          <span className="sr-only" aria-live="polite">
            {active >= 0 ? `${labels[active]}: ${fmt(values[active], format)}` : ""}
          </span>
        </div>
        <div className="cchart-x" aria-hidden="true">
          {labels.map((l, i) => (
            <span key={i} className={i % every === 0 ? "" : "is-hidden"}>
              {l}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="chart-cap" id={`${id}-cap`}>
        {summary}
      </figcaption>
      <details className="chart-table">
        <summary>Tabela danych</summary>
        <div className="table-scroll">
          <table className="table table-compact">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">{xName}</th>
                <th scope="col" className="num">
                  {seriesName}
                </th>
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i}>
                  <th scope="row">{l}</th>
                  <td className="num">{fmt(values[i], format)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
