"use client";
/**
 * Line chart of the analytics screens (DESIGN-SYSTEM.md 3-4): one Y axis, current period 2 px, comparison thinner
 * and grey, optional "typical range" band and reference line, numbered annotations from the change timeline, gaps
 * for buckets without measurement ("bez pomiaru", never a zero), keyboard reading (arrows, Home, End) and a real
 * data table under every chart. Drawn on the server at full width: the SVG is scaled by the browser
 * (preserveAspectRatio none, non-scaling strokes), so nothing is measured and the strict CSP needs no inline
 * styles. Only the tooltip and cursor are positioned through the CSSOM, which CSP allows.
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { niceMax } from "../column-chart";
import { formatValue, NO_MEASUREMENT, type ValueFormat } from "./format";

export type TrendSeries = { name: string; values: (number | null)[]; role: "current" | "compare" };
export type TrendAnnotation = { index: number; when: string; label: string };

export type TrendChartProps = {
  title: string;
  summary: string;
  labels: string[];
  series: TrendSeries[];
  format: ValueFormat;
  xName: string;
  height?: 160 | 200 | 240;
  /** Fixed top of the Y axis (e.g. 100 for percentages); otherwise a round number above the data. */
  yMax?: number;
  annotations?: TrendAnnotation[];
  refLine?: { value: number; label: string };
  band?: { name: string; lo: number[]; hi: number[] };
  /** Table rows every N labels (retention has 100 points). */
  tableStep?: number;
};

const W = 1000;
const H = 100;

export function TrendChart({ title, summary, labels, series, format, xName, height = 200, yMax, annotations = [], refLine, band, tableStep = 1 }: TrendChartProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [active, setActive] = useState(-1);
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const n = labels.length;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const dataMax = Math.max(0, ...all, ...(band ? band.hi : []), refLine?.value ?? 0);
  const max = yMax ?? niceMax(dataMax * 1.05);
  const ticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (Math.min(v, max) / max) * H;
  const hasAny = all.length > 0;
  const every = Math.max(1, Math.ceil(n / 7));

  const pathOf = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const areaOf = (values: (number | null)[]) => {
    // One closed polygon per run of measured buckets.
    const runs: string[] = [];
    let run: number[] = [];
    const flush = () => {
      if (run.length > 1) runs.push(`M${x(run[0]).toFixed(1)},${H}${run.map((i) => `L${x(i).toFixed(1)},${y(values[i] as number).toFixed(1)}`).join("")}L${x(run[run.length - 1]).toFixed(1)},${H}Z`);
      run = [];
    };
    values.forEach((v, i) => (v === null ? flush() : run.push(i)));
    flush();
    return runs.join("");
  };
  const bandPath = band && n > 1 ? `M${band.lo.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("L")}L${band.hi.map((v, i) => `${x(n - 1 - i).toFixed(1)},${y(band.hi[n - 1 - i]).toFixed(1)}`).join("L")}Z` : "";

  function place(i: number) {
    const plot = plotRef.current;
    const tip = tipRef.current;
    const cursor = cursorRef.current;
    if (!plot || !tip || !cursor) return;
    const w = plot.clientWidth;
    const px = n <= 1 ? w / 2 : (i / (n - 1)) * w;
    cursor.style.left = `${px}px`;
    const tw = tip.offsetWidth || 180;
    tip.style.left = `${Math.max(4, px + 14 + tw > w - 4 ? px - tw - 14 : px + 14)}px`;
  }
  function show(i: number) {
    if (i < 0 || i >= n) return;
    setActive(i);
    requestAnimationFrame(() => place(i));
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = n <= 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (n - 1))));
    if (i !== active) show(i);
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = { ArrowRight: active < 0 ? 0 : Math.min(n - 1, active + 1), ArrowLeft: active < 0 ? n - 1 : Math.max(0, active - 1), Home: 0, End: n - 1 };
    if (e.key in map) {
      e.preventDefault();
      show(map[e.key]);
    } else if (e.key === "Escape") setActive(-1);
  }

  const readout = (i: number) => series.map((s) => `${s.name}: ${s.values[i] === null || s.values[i] === undefined ? NO_MEASUREMENT : formatValue(s.values[i] as number, format)}`).join("; ");
  const pctClass = (i: number) => Math.max(0, Math.min(100, Math.round(n <= 1 ? 50 : (i / (n - 1)) * 100)));

  return (
    <figure className="chart">
      {series.length > 1 || band || refLine ? (
        <ul className="legend" aria-label="Legenda">
          {series.map((s) => (
            <li key={s.name}>
              <span className={`key ${s.role === "compare" ? "key-compare" : ""}`} aria-hidden="true" />
              {s.name}
            </li>
          ))}
          {band ? (
            <li>
              <span className="key key-band" aria-hidden="true" />
              {band.name}
            </li>
          ) : null}
          {refLine ? (
            <li>
              <span className="key key-ref" aria-hidden="true" />
              {refLine.label}
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className={`cchart cchart-h-${height}${annotations.length ? " trend-has-notes" : ""}`}>
        <div className="cchart-y" aria-hidden="true">
          <span className="gy-sizer">{formatValue(max, format)}</span>
          {ticks.map((t, i) => (
            <span key={i} className={`gy-${i}`}>
              {formatValue(t, format)}
            </span>
          ))}
        </div>
        <div
          ref={plotRef}
          className="cchart-plot"
          tabIndex={0}
          role="group"
          aria-label={`${title}: wykres liniowy. Strzałki w lewo i prawo czytają wartości; pełne dane w tabeli pod wykresem.`}
          aria-describedby={`${id}-cap`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(-1)}
          onBlur={() => setActive(-1)}
          onKeyDown={onKeyDown}
        >
          {[1, 2, 3, 4].map((g) => (
            <span key={g} className={`cchart-grid gy-${g}`} aria-hidden="true" />
          ))}
          <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {bandPath ? <path className="trend-band" d={bandPath} /> : null}
            {series
              .filter((s) => s.role === "compare")
              .map((s) => (
                <path key={`c-${s.name}`} className="trend-line compare" d={pathOf(s.values)} />
              ))}
            {series
              .filter((s) => s.role === "current")
              .map((s) => (
                <g key={`s-${s.name}`}>
                  <path className="trend-area" d={areaOf(s.values)} />
                  <path className="trend-line" d={pathOf(s.values)} />
                </g>
              ))}
            {refLine && refLine.value <= max ? <line className="trend-ref" x1="0" x2={W} y1={y(refLine.value)} y2={y(refLine.value)} /> : null}
          </svg>
          {annotations.map((a, k) => (
            <span key={`n-${k}`} className={`trend-note-line pl-${pctClass(a.index)}`} aria-hidden="true" />
          ))}
          {annotations.map((a, k) => (
            <span key={`m-${k}`} className={`trend-note pl-${pctClass(a.index)}`} aria-hidden="true">
              {k + 1}
            </span>
          ))}
          {!hasAny ? <span className="trend-gap">{NO_MEASUREMENT}</span> : null}
          <div ref={cursorRef} className="trend-cursor" hidden={active < 0} aria-hidden="true" />
          <div ref={tipRef} className="chart-tip" hidden={active < 0} aria-hidden="true">
            {active >= 0 ? (
              <>
                <div className="tip-title">{labels[active]}</div>
                {series.map((s) => (
                  <div className="tip-row" key={s.name}>
                    <span className="tip-key" />
                    <strong>{s.values[active] === null || s.values[active] === undefined ? NO_MEASUREMENT : formatValue(s.values[active] as number, format)}</strong>
                    <span>{s.name}</span>
                  </div>
                ))}
              </>
            ) : null}
          </div>
          <span className="sr-only" aria-live="polite">
            {active >= 0 ? `${labels[active]}. ${readout(active)}` : ""}
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
      {annotations.length ? (
        <ol className="chart-notes" aria-label="Adnotacje: co się zmieniło">
          {annotations.map((a, k) => (
            <li key={k}>
              <span className="note-num" aria-hidden="true">
                {k + 1}
              </span>
              <span className="sr-only">Adnotacja {k + 1}: </span>
              {a.when} · {a.label}
            </li>
          ))}
        </ol>
      ) : null}
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
                {series.map((s) => (
                  <th key={s.name} scope="col" className="num">
                    {s.name}
                  </th>
                ))}
                {band ? (
                  <th scope="col" className="num">
                    {band.name} (od–do)
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) =>
                i % tableStep === 0 || i === n - 1 ? (
                  <tr key={i}>
                    <th scope="row">{l}</th>
                    {series.map((s) => (
                      <td key={s.name} className="num">
                        {s.values[i] === null || s.values[i] === undefined ? NO_MEASUREMENT : formatValue(s.values[i] as number, format)}
                      </td>
                    ))}
                    {band ? <td className="num">{`${formatValue(band.lo[i], format)}–${formatValue(band.hi[i], format)}`}</td> : null}
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
