"use client";

import { useId } from "react";
import { niceMax } from "./analytics-format";

export interface ChartSeries {
  id: string;
  label: string;
  /** One value per x label; null leaves a gap (no data, never drawn as zero). */
  values: (number | null)[];
  dashed?: boolean;
}

interface Props {
  title: string;
  /** Text shown for each x position (also the first column of the data table). */
  xLabels: string[];
  series: ChartSeries[];
  formatValue: (n: number) => string;
  /** Alternative text (screen readers). The data table below the chart carries the exact numbers. */
  summary: string;
  tableSummaryLabel: string;
  xColumnLabel: string;
  emptyLabel: string;
}

const W = 640;
const H = 220;
const PAD = { left: 48, right: 12, top: 12, bottom: 26 };

/**
 * Dependency-free SVG line chart. Accessible by construction: the SVG has a text alternative and every plotted
 * number is also in a table under it (a `<details>`, closed by default).
 */
export default function LineChart({ title, xLabels, series, formatValue, summary, tableSummaryLabel, xColumnLabel, emptyLabel }: Props) {
  const uid = useId();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const n = xLabels.length;
  const hasData = all.length > 0 && n > 0;
  const max = niceMax(all.length ? Math.max(...all) : 0);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => PAD.top + plotH - (plotH * v) / max;

  const pathOf = (values: (number | null)[]) => {
    let d = "";
    let open = false;
    values.forEach((v, i) => {
      if (v === null) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      open = true;
    });
    return d.trim();
  };

  const ticks = [0, 0.5, 1].map((f) => f * max);
  const xTickIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-[13px] font-semibold text-[var(--chan-ink)]">{title}</figcaption>
      {hasData ? (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`} className="h-auto w-full">
          <title id={`${uid}-t`}>{title}</title>
          <desc id={`${uid}-d`}>{summary}</desc>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chan-line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--chan-muted)">
                {formatValue(t)}
              </text>
            </g>
          ))}
          {xTickIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill="var(--chan-muted)">
              {xLabels[i]}
            </text>
          ))}
          {series.map((s) => (
            <path
              key={s.id}
              d={pathOf(s.values)}
              fill="none"
              stroke="var(--chan-ink)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "5 4" : undefined}
              opacity={s.dashed ? 0.55 : 1}
            />
          ))}
          {series.map((s) =>
            s.values.length > 0 && s.values.length <= 31
              ? s.values.map((v, i) => (v === null ? null : <circle key={`${s.id}-${i}`} cx={x(i)} cy={y(v)} r={2.5} fill="var(--chan-ink)" />))
              : null,
          )}
        </svg>
      ) : (
        <p className="rounded-xl bg-[var(--chan-surface)] px-3 py-6 text-center text-[13px] text-[var(--chan-muted)]">{emptyLabel}</p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-[var(--chan-muted)]">{tableSummaryLabel}</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-[12px] tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-3 font-semibold">
                  {xColumnLabel}
                </th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="py-1 pr-3 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xLabels.map((label, i) => (
                <tr key={`${label}-${i}`} className="border-t border-[var(--chan-line)]">
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {label}
                  </th>
                  {series.map((s) => (
                    <td key={s.id} className="py-1 pr-3 text-right">
                      {s.values[i] === null || s.values[i] === undefined ? "–" : formatValue(s.values[i] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
