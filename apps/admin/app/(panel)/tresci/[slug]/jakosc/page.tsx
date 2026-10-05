import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEdgeSnapshot, getQualityOverview, getVideoInfo } from "@/lib/modules/admin-analytics";
import { parseCompare, parseRange } from "@/lib/modules/admin-overview";
import { BarList, Notes, periodLede, RollupAge, SeriesChart, UnavailableCard } from "@admin/components/analytics/parts";
import { QualityTiles } from "@admin/components/analytics/quality-parts";
import { FilmTabs } from "@admin/components/content/film-tabs";
import { Icon } from "@admin/components/icons";
import { RefreshButton } from "@admin/components/refresh-button";
import { Card, PageHead } from "@admin/components/ui";
import { analyticsDeps } from "@admin/lib/analytics";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const metadata: Metadata = { title: "Jakość odtwarzania filmu" };

export default async function FilmQualityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const deps = analyticsDeps();
  const video = await getVideoInfo(deps, slug);
  if (!video) notFound();
  const compare = parseCompare(one(sp.cmp));
  const [res] = await Promise.all([getQualityOverview(deps, { range: parseRange(one(sp.range)), compare, videoId: video.id }), getEdgeSnapshot(deps).catch(() => null)]);
  const now = deps.now();
  const d = res.available ? res.data : null;
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
        lede={d ? periodLede(d.rangeLabel, d.compareLabel, compare !== "none") : "Jakość odtwarzania filmu"}
        actions={<RefreshButton />}
      />
      <FilmTabs slug={video.slug} current="jakosc" />
      {!d || !res.available ? (
        <UnavailableCard reason={res.available ? "Brak danych." : res.reason} />
      ) : (
        <div className="grid">
          <div className="span-12">
            <QualityTiles d={d} />
          </div>
          <div className="span-6">
            <Card id="h-st" title="Czas startu p95" meta={<RollupAge rollupAt={d.freshness.rollupAt} now={now} />}>
              <SeriesChart
                title="Czas startu p95"
                summary="Czas od żądania odtworzenia do pierwszej klatki, 95. percentyl z dnia. Przerwa = brak startów tego dnia."
                series={{ ...d.startupP95Series, current: d.startupP95Series.current.map((v) => (v === null ? null : v / 1000)), previous: d.startupP95Series.previous?.map((v) => (v === null ? null : v / 1000)) ?? null }}
                format="sec"
                xName="Doba"
                name="p95"
                refLine={{ value: 2, label: "cel 2 s" }}
                annotations={d.annotations}
              />
            </Card>
          </div>
          <div className="span-6">
            <Card id="h-err" title="Odsetek prób z błędem">
              <SeriesChart title="Odsetek prób z błędem" summary="Odsetek prób z jakimkolwiek błędem." series={d.errorRateSeries} format="pct" xName="Doba" name="Z błędem" annotations={d.annotations} />
            </Card>
          </div>
          <div className="span-6">
            <Card id="h-ladder" title="Rendycje" sub="Najwyższa jakość osiągnięta w próbie.">
              <BarList items={d.ladder.map((l) => ({ label: l.label, value: l.attempts, share: l.share }))} empty="Bez pomiaru: odtwarzacz nie zgłosił jakości." />
            </Card>
          </div>
          <div className="span-6">
            <Card id="h-errs" title="Błędy odtwarzania wg typu">
              <BarList items={d.errors.map((e) => ({ label: e.label, value: e.attempts, share: e.share, sub: e.fatal ? `w tym krytycznych: ${e.fatal}` : undefined }))} empty="Brak błędów w tym okresie." />
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
