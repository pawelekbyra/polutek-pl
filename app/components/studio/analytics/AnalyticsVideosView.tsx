"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import type { AnalyticsVideoList, VideoStatsRow } from "@/lib/modules/creator-analytics";
import { Card, focusRingClass, ghostButtonClass } from "../ui";
import { FreshnessLabel, NotEnoughData } from "./AnalyticsParts";
import { formatPercent, formatWatchTime, sortRows, type SortDir, type SortKey } from "./analytics-format";

/** Per-video table. Sortable on a table from `sm` up; below it each video is a stacked card (one column). */
export default function AnalyticsVideosView({ data, onOpen }: { data: AnalyticsVideoList; onOpen: (videoId: string) => void }) {
  const { tx, language } = useLanguage();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "views", dir: "desc" });
  const num = (n: number) => new Intl.NumberFormat(language).format(n);
  const rows = useMemo(() => sortRows<VideoStatsRow>(data.items, sort.key, sort.dir), [data.items, sort]);

  const columns: { key: SortKey; label: string; numeric: boolean }[] = [
    { key: "title", label: tx("Film", "Video"), numeric: false },
    { key: "views", label: tx("Wyświetlenia", "Views"), numeric: true },
    { key: "watchSeconds", label: tx("Czas oglądania", "Watch time"), numeric: true },
    { key: "avgPctViewed", label: tx("Średni % obejrzenia", "Average % viewed"), numeric: true },
    { key: "comments", label: tx("Komentarze", "Comments"), numeric: true },
    { key: "likes", label: tx("Polubienia", "Likes"), numeric: true },
  ];
  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "title" ? "asc" : "desc" }));

  const avgCell = (v: VideoStatsRow) => formatPercent(v.avgPctViewed, language) ?? (v.avgState === "no_data" ? "–" : <NotEnoughData minSample={data.minSample} />);

  return (
    <Card title={tx("Filmy kanału", "Channel videos")}>
      {rows.length === 0 ? (
        <p className="text-[14px] text-[var(--chan-muted)]">{tx("Nie masz jeszcze opublikowanych filmów.", "You have no published videos yet.")}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:hidden">
            <label htmlFor="analytics-sort" className="text-[12px] font-semibold text-[var(--chan-muted)]">
              {tx("Sortuj wg", "Sort by")}
            </label>
            <select
              id="analytics-sort"
              className="rounded-lg border border-[var(--chan-line)] bg-[var(--chan-card)] px-2 py-1 text-[13px]"
              value={sort.key}
              onChange={(e) => setSort({ key: e.target.value as SortKey, dir: e.target.value === "title" ? "asc" : "desc" })}
            >
              {columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <ul className="grid gap-3 sm:hidden">
            {rows.map((v) => (
              <li key={v.id} className="rounded-xl border border-[var(--chan-line)] p-3">
                <button type="button" onClick={() => onOpen(v.id)} className={`text-left text-[14px] font-semibold text-[var(--chan-ink)] underline-offset-2 hover:underline ${focusRingClass}`}>
                  {v.title}
                </button>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-[var(--chan-muted)]">{tx("Wyświetlenia", "Views")}</dt>
                  <dd className="text-right tabular-nums">{num(v.views)}</dd>
                  <dt className="text-[var(--chan-muted)]">{tx("Czas oglądania", "Watch time")}</dt>
                  <dd className="text-right tabular-nums">{formatWatchTime(v.watchSeconds)}</dd>
                  <dt className="text-[var(--chan-muted)]">{tx("Średni % obejrzenia", "Average % viewed")}</dt>
                  <dd className="text-right tabular-nums">{avgCell(v)}</dd>
                  <dt className="text-[var(--chan-muted)]">{tx("Komentarze", "Comments")}</dt>
                  <dd className="text-right tabular-nums">{num(v.comments)}</dd>
                  <dt className="text-[var(--chan-muted)]">{tx("Polubienia", "Likes")}</dt>
                  <dd className="text-right tabular-nums">{num(v.likes)}</dd>
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-[13px]">
              <caption className="sr-only">{tx("Statystyki filmów kanału", "Channel video statistics")}</caption>
              <thead>
                <tr className="border-b border-[var(--chan-line)]">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`py-2 pr-3 font-semibold ${c.numeric ? "text-right" : ""}`}
                    >
                      <button type="button" onClick={() => toggle(c.key)} className={`rounded font-semibold ${focusRingClass}`}>
                        {c.label}
                        {sort.key === c.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-b border-[var(--chan-line)] last:border-0">
                    <th scope="row" className="max-w-[320px] py-2 pr-3 text-left font-normal">
                      <button type="button" onClick={() => onOpen(v.id)} className={`truncate text-left font-semibold text-[var(--chan-ink)] underline-offset-2 hover:underline ${focusRingClass}`}>
                        {v.title}
                      </button>
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(v.views)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatWatchTime(v.watchSeconds)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{avgCell(v)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(v.comments)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(v.likes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.truncated && (
            <p className="mt-3 text-[12px] text-[var(--chan-muted)]">
              {tx("Pokazujemy najnowsze {0} filmów.", "Showing the newest {0} videos.", data.items.length)}
            </p>
          )}
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <FreshnessLabel generatedAt={data.freshness.generatedAt} />
        <a
          className={ghostButtonClass}
          href={`/api/studio/analytics/export?range=${data.range}&kind=videos`}
          download
        >
          {tx("Pobierz CSV", "Download CSV")}
        </a>
      </div>
    </Card>
  );
}
