import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVideoAnalytics, getVideoInfo } from "@/lib/modules/admin-analytics";
import { fmtPercent, parseCompare, parseRange } from "@/lib/modules/admin-overview";
import { KpiTiles, LowSample, Notes, periodLede, RollupAge, SeriesChart, UnavailableCard } from "@admin/components/analytics/parts";
import { TrendChart } from "@admin/components/analytics/trend-chart";
import { FilmTabs } from "@admin/components/content/film-tabs";
import { Icon } from "@admin/components/icons";
import { RefreshButton } from "@admin/components/refresh-button";
import { Card, PageHead } from "@admin/components/ui";
import { analyticsDeps } from "@admin/lib/analytics";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const metadata: Metadata = { title: "Analityka filmu" };

export default async function FilmAnalyticsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const deps = analyticsDeps();
  const video = await getVideoInfo(deps, slug);
  if (!video) notFound();
  const range = parseRange(one(sp.range));
  const compare = parseCompare(one(sp.cmp));
  const res = await getVideoAnalytics(deps, video, { range, compare });
  const now = deps.now();
  const d = res.available ? res.data : null;
  const r = d?.retention;
  const durLabel = (pct: number) => {
    if (!r?.durationSeconds) return `${pct}%`;
    const s = Math.round((r.durationSeconds * pct) / 100);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const m = (at: number) => r?.milestones.find((x) => x.at === at)?.pct ?? 0;
  return (
    <>
      <PageHead
        title={video.title}
        crumbs={
          <>
            <Link href="/tresci">Treści</Link>
            <Icon name="right" />
            <span>{video.title}</span>
          </>
        }
        lede={d ? periodLede(d.rangeLabel, d.compareLabel, compare !== "none") : "Analityka filmu"}
        actions={<RefreshButton />}
      />
      <FilmTabs slug={video.slug} current="analityka" />
      {!d || !res.available ? (
        <UnavailableCard reason={res.available ? "Brak danych." : res.reason} />
      ) : (
        <div className="grid">
          <div className="span-12">
            <KpiTiles kpis={d.kpis} compare={compare !== "none"} context={d.compareLabel} label={`Analityka filmu ${video.title}`} />
          </div>
          <div className="span-12">
            <Card id="h-v" title="Obejrzenia w czasie" meta={<RollupAge rollupAt={d.freshness.rollupAt} now={now} />} sub="Numerowane znaczniki: wdrożenia i publikacje filmów.">
              <SeriesChart title="Obejrzenia w czasie" summary="Starty z co najmniej 10 s oglądania." series={d.views} format="int" xName="Przedział" name="Obejrzenia" annotations={d.annotations} height={200} />
            </Card>
          </div>
          <div className="span-12">
            <Card id="h-r" title="Retencja" sub="Jaki procent startów obejrzał dany moment filmu. Szare pasmo: typowy zakres innych filmów kanału.">
              {r ? (
                <>
                  {r.lowSample ? <LowSample>Mała próba: n = {r.starts} startów. Krzywa jest orientacyjna.</LowSample> : null}
                  <TrendChart
                    title={`Retencja: ${r.title}`}
                    summary={`Średnio ${fmtPercent(r.avgWatchedPct, 0)} filmu. Po 25%: ${fmtPercent(m(25), 0)}, po 50%: ${fmtPercent(m(50), 0)}, po 75%: ${fmtPercent(m(75), 0)}; do końca ${fmtPercent(m(100), 0)}.${r.biggestDrop ? ` Największy spadek ok. ${r.biggestDrop.at}% filmu.` : ""}`}
                    labels={r.percent.map((_, i) => durLabel(i))}
                    series={[{ name: r.title, values: r.percent, role: "current" }]}
                    band={r.band ? { name: `Typowy film kanału (${r.band.videos} filmów)`, lo: r.band.lo, hi: r.band.hi } : undefined}
                    format="pct"
                    xName="Moment filmu"
                    yMax={100}
                    height={240}
                    tableStep={5}
                  />
                </>
              ) : (
                <UnavailableCard reason="Brak startów tego filmu w wybranym okresie, więc nie ma z czego narysować krzywej." />
              )}
            </Card>
          </div>
          <div className="span-12">
            <Notes items={d.notes} />
          </div>
        </div>
      )}
    </>
  );
}
