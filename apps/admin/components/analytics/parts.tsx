/** Server-rendered pieces shared by the analytics screens. No inline styles, no client code. */
import type { ReactNode } from "react";
import { Icon } from "../icons";
import { Delta, Tile } from "../ui";
import type { Annotation, KpiDto, RankedItem, TimeSeriesDto, Unavailable } from "@/lib/modules/admin-analytics";
import { fmtDateTime, fmtRelative } from "@/lib/modules/admin-overview";
import { formatValue, NO_MEASUREMENT, type ValueFormat } from "./format";
import { TrendChart, type TrendChartProps } from "./trend-chart";

export function UnavailableCard({ title, reason }: { title?: string; reason: string }) {
  return (
    <div className="unavailable" role="note">
      <Icon name="info" />
      <div>
        <strong>{title ?? "Bez pomiaru."}</strong> {reason}
      </div>
    </div>
  );
}

export function KpiTiles({ kpis, compare, context, label }: { kpis: KpiDto[]; compare: boolean; context: string; label: string }) {
  return (
    <div className="tiles" role="group" aria-label={label}>
      {kpis.map((k) => (
        <Tile
          key={k.key}
          label={k.label}
          hint={k.hint}
          value={k.value === null ? <span className="nomeasure">{NO_MEASUREMENT}</span> : formatValue(k.value, k.format)}
          unit={k.value === null ? undefined : k.unit}
          delta={k.value === null ? undefined : <Delta current={k.value} previous={compare ? k.previous : null} upIsGood={k.upIsGood} context={compare ? context : ""} />}
        />
      ))}
    </div>
  );
}

export function BarList({ items, format = "int", empty, ordinal, valueText }: { items: RankedItem[]; format?: ValueFormat; empty?: string; ordinal?: boolean; valueText?: (i: RankedItem) => string }) {
  if (items.length === 0) return <p className="muted">{empty ?? "Bez pomiaru: w tym okresie nic nie zebrano."}</p>;
  return (
    <ul className={`bars${ordinal ? " bars-ordinal" : ""}`}>
      {items.map((it) => (
        <li key={it.label}>
          <span className="bl-label" title={it.label}>
            {it.label}
          </span>
          <span className="bl-value">{valueText ? valueText(it) : `${formatValue(it.value, format)} · ${Math.round(it.share)}%`}</span>
          <div className="bl-track" aria-hidden="true">
            <div className={`bl-fill pw-${Math.max(0, Math.min(100, Math.round(it.share)))}`} />
          </div>
          {it.sub ? <span className="bl-sub">{it.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function LowSample({ children }: { children: ReactNode }) {
  return (
    <p className="lowsample" role="note">
      <Icon name="warn" />
      <span>{children}</span>
    </p>
  );
}

export function Notes({ items }: { items: string[] }) {
  return items.length ? (
    <ul className="notes">
      {items.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  ) : null;
}

/** Line chart of a (current, previous) pair of series, with the panel's annotations. */
export function SeriesChart({
  title, summary, series, format, xName, annotations, name, compareName, height, yMax, refLine, band, tableStep,
}: {
  title: string; summary: string; series: TimeSeriesDto; format: ValueFormat; xName: string; annotations?: Annotation[]; name: string; compareName?: string;
  height?: TrendChartProps["height"]; yMax?: number; refLine?: TrendChartProps["refLine"]; band?: TrendChartProps["band"]; tableStep?: number;
}) {
  return (
    <TrendChart
      title={title}
      summary={summary}
      labels={series.labels}
      series={[
        ...(series.previous ? [{ name: compareName ?? "Poprzedni okres", values: series.previous, role: "compare" as const }] : []),
        { name, values: series.current, role: "current" as const },
      ]}
      format={format}
      xName={xName}
      height={height}
      yMax={yMax}
      refLine={refLine}
      band={band}
      tableStep={tableStep}
      annotations={annotations?.map((a) => ({ index: a.index, when: a.when, label: a.label }))}
    />
  );
}

/** "dane z 14:32" style age of the rollup: the freshness of every number on the screen. */
export function RollupAge({ rollupAt, now }: { rollupAt: string | null; now: Date }) {
  if (!rollupAt)
    return (
      <span className="age stale">
        <Icon name="warn" />
        brak pomiaru: rollup jeszcze się nie wykonał
      </span>
    );
  const stale = now.getTime() - new Date(rollupAt).getTime() > 2 * 5 * 60_000;
  return (
    <span className={`age${stale ? " stale" : ""}`} title="Liczby pochodzą z agregatów liczonych co 5 minut.">
      <Icon name={stale ? "warn" : "clock"} />
      {stale ? "nieaktualne · " : ""}dane z {fmtDateTime(rollupAt, now)} ({fmtRelative(rollupAt, now)})
    </span>
  );
}

export const periodLede = (rangeLabel: string, compareLabel: string, compare: boolean) => `${rangeLabel}${compare ? `, ${compareLabel}` : ""}`;
