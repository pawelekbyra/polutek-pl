import type { Metadata } from "next";
import Link from "next/link";
import {
  getEdgeSnapshot,
  getFunnel,
  getQualityOverview,
  getTrafficOverview,
  getWatchOverview,
  type EdgeSnapshot,
  type FunnelDto,
  type QualityOverview,
  type TrafficOverview,
  type WatchOverview,
} from "@/lib/modules/admin-analytics";
import { fmtInt, fmtOne, fmtPercent, parseCompare, parseRange } from "@/lib/modules/admin-overview";
import { AnalyticsTabs, parseTab, type AnalyticsTab } from "@admin/components/analytics/analytics-tabs";
import { BarList, KpiTiles, LowSample, Notes, periodLede, RollupAge, SeriesChart, UnavailableCard } from "@admin/components/analytics/parts";
import { EdgeCard, QualityTiles } from "@admin/components/analytics/quality-parts";
import { TrendChart } from "@admin/components/analytics/trend-chart";
import { RefreshButton } from "@admin/components/refresh-button";
import { Badge, Card, PageHead, State } from "@admin/components/ui";
import { analyticsDeps } from "@admin/lib/analytics";

export const metadata: Metadata = { title: "Analityka" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AnalyticsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const range = parseRange(one(sp.range));
  const compare = parseCompare(one(sp.cmp));
  const tab = parseTab(one(sp.tab));
  const deps = analyticsDeps();
  const now = deps.now();
  const query = { range: one(sp.range), cmp: one(sp.cmp) };
  const cmp = compare !== "none";

  let lede = "";
  let body;
  if (tab === "ruch") {
    const traffic = await getTrafficOverview(deps, { range, compare });
    if (traffic.available) lede = periodLede(traffic.data.rangeLabel, traffic.data.compareLabel, cmp);
    body = traffic.available ? <TrafficTab d={traffic.data} cmp={cmp} now={now} /> : <UnavailableCard reason={traffic.reason} />;
  } else if (tab === "lejek") {
    const f = await getFunnel(deps, { range, compare });
    if (f.available) lede = f.data.rangeLabel;
    body = f.available ? <FunnelTab d={f.data} now={now} /> : <UnavailableCard reason={f.reason} />;
  } else if (tab === "ogladalnosc") {
    const w = await getWatchOverview(deps, { range, compare, video: one(sp.video) });
    if (w.available) lede = periodLede(w.data.rangeLabel, w.data.compareLabel, cmp);
    body = w.available ? <WatchTab d={w.data} cmp={cmp} now={now} query={query} selected={one(sp.video)} /> : <UnavailableCard reason={w.reason} />;
  } else {
    const [q, edge] = await Promise.all([getQualityOverview(deps, { range, compare }), getEdgeSnapshot(deps)]);
    if (q.available) lede = periodLede(q.data.rangeLabel, q.data.compareLabel, cmp);
    body = q.available ? <QualityTab d={q.data} cmp={cmp} now={now} edge={edge} /> : <UnavailableCard reason={q.reason} />;
  }

  return (
    <>
      <PageHead title="Analityka" lede={lede || "Ruch, oglądalność i jakość odtwarzania z własnej telemetrii (bez ciasteczek)."} actions={<RefreshButton />} />
      <AnalyticsTabs current={tab as AnalyticsTab} query={query} />
      {body}
    </>
  );
}

function TrafficTab({ d, cmp, now }: { d: TrafficOverview; cmp: boolean; now: Date }) {
  const hourly = d.granularity === "hour";
  return (
    <div className="grid">
      <div className="span-12">
        <KpiTiles kpis={d.kpis} compare={cmp} context={d.compareLabel} label={`Ruch, ${d.rangeLabel}`} />
      </div>
      <div className="span-12">
        <Card id="h-vis" title="Odwiedzający w czasie" meta={<RollupAge rollupAt={d.freshness.rollupAt} now={now} />} sub="Numerowane znaczniki to zmiany z osi zmian: wdrożenia i publikacje filmów.">
          <SeriesChart
            title="Odwiedzający w czasie"
            summary={hourly ? "Unikalni odwiedzający w każdej godzinie (w godzinie, nie w dobie: sumy godzin są wyższe niż liczba dobowa)." : "Unikalni odwiedzający w każdej dobie (czas warszawski)."}
            series={d.visitors}
            format="int"
            xName={hourly ? "Godzina" : "Doba"}
            name="Odwiedzający"
            annotations={d.annotations}
            height={240}
          />
        </Card>
      </div>
      <div className="span-12">
        <Card id="h-pv" title="Odsłony w czasie">
          <SeriesChart title="Odsłony w czasie" summary="Liczba odsłon stron." series={d.pageviews} format="int" xName={hourly ? "Godzina" : "Doba"} name="Odsłony" annotations={d.annotations} height={200} />
        </Card>
      </div>
      <div className="span-4">
        <Card id="h-src" title="Źródła ruchu" sub="Strona odsyłająca; udział w sumie dobowych unikalnych.">
          <BarList items={d.sources} />
        </Card>
      </div>
      <div className="span-4">
        <Card id="h-cty" title="Kraje">
          <BarList items={d.countries} />
        </Card>
      </div>
      <div className="span-4">
        <Card id="h-utm" title="Kampanie (utm_source)" sub="Tylko linki oznaczone parametrem utm_source.">
          <BarList items={d.campaigns} empty="Bez pomiaru: żaden odwiedzający nie przyszedł z oznaczonego linku." />
        </Card>
      </div>
      <div className="span-12">
        <EdgeCheckCard check={d.edgeCheck} />
      </div>
      <div className="span-12">
        <Notes items={d.notes} />
      </div>
    </div>
  );
}

function EdgeCheckCard({ check }: { check: TrafficOverview["edgeCheck"] }) {
  return (
    <Card id="h-edge" title="Kontrola krzyżowa z Cloudflare" sub="Własne odsłony kontra żądania dokumentów HTML widziane na krawędzi Cloudflare (z botami).">
      {check.available ? (
        <p>
          <State kind={check.withinTolerance ? "ok" : "warn"}>{check.withinTolerance ? "w granicach" : "poza granicą"}</State> Własne: {fmtInt(check.ownPageviews)}, Cloudflare: {fmtInt(check.edgeRequests)}, różnica {fmtPercent(check.deviationPct, 1)} (granica ±{check.tolerancePct}%). Różnica jest naturalna: kolektor odrzuca boty i osoby z GPC/DNT.
        </p>
      ) : (
        <UnavailableCard reason={check.reason} />
      )}
    </Card>
  );
}

function FunnelTab({ d, now }: { d: FunnelDto; now: Date }) {
  const first = d.steps[0]?.count ?? null;
  return (
    <div className="grid">
      <div className="span-7">
        <Card id="h-fun" title="Ścieżka: wejście → konto → komentarz → napiwek" meta={<RollupAge rollupAt={d.freshness.rollupAt} now={now} />} sub={`${d.rangeLabel} · procent to przejście z poprzedniego kroku`}>
          <BarList
            ordinal
            items={d.steps.map((s) => ({ label: s.label, value: s.count ?? 0, share: s.count !== null && first && first > 0 ? Math.min(100, (100 * s.count) / first) : s.count !== null && s.key !== "visitors" && !first ? 100 : 0, sub: s.hint }))}
            valueText={(it) => {
              const s = d.steps.find((x) => x.label === it.label)!;
              if (s.count === null) return "bez pomiaru";
              return `${fmtInt(s.count)}${s.pctOfPrevious !== null && s.key !== "visitors" ? ` · ${fmtPercent(s.pctOfPrevious, 1)} z poprzedniego` : ""}`;
            }}
          />
          {d.sample !== "ok" ? <LowSample>Mała próba: {d.tipsInPeriod} napiwków w okresie. Wnioski o ostatnich krokach traktuj ostrożnie.</LowSample> : null}
          {d.lossHint ? <p className="limit-note">{d.lossHint}</p> : null}
        </Card>
      </div>
      <div className="span-5">
        <Card id="h-attr" title="Atrybucja" sub="Skąd pochodzą konta i napiwki">
          <UnavailableCard reason={d.attribution.reason} />
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-acc" title="Nowe konta w czasie">
          <SeriesChart title="Nowe konta" summary="Liczba kont założonych w każdym przedziale." series={d.accounts} format="int" xName="Przedział" name="Nowe konta" height={160} />
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-tips" title="Napiwki w czasie" sub="Liczba opłaconych wpłat (kwoty: Przychody).">
          <SeriesChart title="Napiwki" summary="Liczba opłaconych napiwków w każdym przedziale." series={d.tips} format="int" xName="Przedział" name="Napiwki" height={160} />
        </Card>
      </div>
      <div className="span-12">
        <Notes items={d.notes} />
      </div>
    </div>
  );
}

function WatchTab({ d, cmp, now, query, selected }: { d: WatchOverview; cmp: boolean; now: Date; query: Record<string, string | undefined>; selected?: string }) {
  const r = d.retention;
  const durLabel = (pct: number) => {
    if (!r?.durationSeconds) return `${pct}%`;
    const s = Math.round((r.durationSeconds * pct) / 100);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const labels = r ? r.percent.map((_, i) => durLabel(i)) : [];
  const m = (at: number) => r?.milestones.find((x) => x.at === at)?.pct;
  return (
    <div className="grid">
      <div className="span-12">
        <KpiTiles kpis={d.kpis} compare={cmp} context={d.compareLabel} label="Oglądalność" />
      </div>
      <div className="span-6">
        <Card id="h-views" title="Obejrzenia w czasie" meta={<RollupAge rollupAt={d.freshness.rollupAt} now={now} />}>
          <SeriesChart title="Obejrzenia w czasie" summary="Starty z co najmniej 10 s oglądania." series={d.views} format="int" xName="Przedział" name="Obejrzenia" annotations={d.annotations} height={200} />
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-watch" title="Czas oglądania w czasie">
          <SeriesChart title="Czas oglądania w czasie" summary="Godziny oglądania w każdym przedziale." series={d.watchHours} format="h" xName="Przedział" name="Czas oglądania" annotations={d.annotations} height={200} />
        </Card>
      </div>
      <div className="span-7">
        <Card
          id="h-ret"
          title={r ? `Retencja: ${r.title}` : "Retencja"}
          meta={
            <form className="row" method="get" action="/analityka">
              <input type="hidden" name="tab" value="ogladalnosc" />
              {query.range ? <input type="hidden" name="range" value={query.range} /> : null}
              {query.cmp ? <input type="hidden" name="cmp" value={query.cmp} /> : null}
              <label className="sr-only" htmlFor="ret-film">Film</label>
              <select className="select" id="ret-film" name="video" defaultValue={selected ?? r?.videoId ?? ""}>
                {d.videos.map((v) => (
                  <option key={v.videoId} value={v.slug ?? v.videoId}>
                    {v.title}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-sm">Pokaż</button>
            </form>
          }
          sub="Jaki procent startów obejrzał dany moment filmu. Szare pasmo to typowy zakres innych filmów kanału."
        >
          {r ? (
            <>
              {r.lowSample ? <LowSample>Mała próba: n = {r.starts} startów. Krzywa jest orientacyjna.</LowSample> : null}
              <TrendChart
                title={`Retencja: ${r.title}`}
                summary={`Średnio ${fmtPercent(r.avgWatchedPct, 0)} filmu. Po 25% zostaje ${fmtPercent(m(25) ?? 0, 0)}, po 50%: ${fmtPercent(m(50) ?? 0, 0)}, po 75%: ${fmtPercent(m(75) ?? 0, 0)}; do końca dociera ${fmtPercent(m(100) ?? 0, 0)}.${r.biggestDrop ? ` Największy spadek ok. ${r.biggestDrop.at}% filmu (−${Math.round(r.biggestDrop.drop)} pp).` : ""}`}
                labels={labels}
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
            <UnavailableCard reason="Brak startów odtwarzania w tym okresie, więc nie ma z czego narysować krzywej." />
          )}
        </Card>
      </div>
      <div className="span-5">
        <Card id="h-vids" title="Filmy w okresie" flush>
          {d.videos.length ? (
            <div className="table-scroll">
              <table className="table table-compact">
                <caption className="sr-only">Najczęściej oglądane filmy</caption>
                <thead>
                  <tr>
                    <th scope="col">Film</th>
                    <th scope="col" className="num">Starty</th>
                    <th scope="col" className="num">Obejrzenia</th>
                    <th scope="col" className="num">Śr. %</th>
                    <th scope="col">vs typowo</th>
                  </tr>
                </thead>
                <tbody>
                  {d.videos.slice(0, 12).map((v) => {
                    const diff = v.avgWatchedPct !== null && d.typicalAvgPct !== null ? v.avgWatchedPct - d.typicalAvgPct : null;
                    return (
                      <tr key={v.videoId}>
                        <th scope="row">{v.slug ? <Link href={`/tresci/${v.slug}/analityka`}>{v.title}</Link> : v.title}</th>
                        <td className="num">{fmtInt(v.starts)}</td>
                        <td className="num">{fmtInt(v.views)}</td>
                        <td className="num">{v.avgWatchedPct === null ? "bez pomiaru" : `${fmtOne(v.avgWatchedPct)}%`}</td>
                        <td>
                          {v.sample !== "ok" ? <Badge kind="warn">mała próba (n = {v.attempts})</Badge> : diff === null ? "—" : diff > 5 ? <Badge kind="ok">powyżej</Badge> : diff < -5 ? <Badge kind="warn">poniżej</Badge> : <Badge icon={false}>typowo</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Bez pomiaru: w tym okresie nikt nie uruchomił filmu.</p>
          )}
        </Card>
      </div>
      <div className="span-12">
        <Notes items={d.notes} />
      </div>
    </div>
  );
}

function QualityTab({ d, cmp, now, edge }: { d: QualityOverview; cmp: boolean; now: Date; edge: EdgeSnapshot }) {
  return (
    <div className="grid">
      <div className="span-12">
        <QualityTiles d={d} />
      </div>
      <div className="span-6">
        <Card id="h-st" title="Czas startu p95" meta={<RollupAge rollupAt={d.freshness.rollupAt} now={now} />}>
          <SeriesChart
            title="Czas startu p95"
            summary="Czas od żądania odtworzenia do pierwszej klatki, 95. percentyl z dnia. Przerwa w linii = brak startów tego dnia."
            series={{ ...d.startupP95Series, current: d.startupP95Series.current.map((v) => (v === null ? null : v / 1000)), previous: d.startupP95Series.previous?.map((v) => (v === null ? null : v / 1000)) ?? null }}
            format="sec"
            xName="Doba"
            name="p95"
            refLine={{ value: 2, label: "cel 2 s" }}
            annotations={d.annotations}
            height={200}
          />
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-err" title="Odsetek prób z błędem">
          <SeriesChart title="Odsetek prób z błędem" summary="Odsetek prób odtworzenia, w których wystąpił błąd (także naprawiony przez odtwarzacz)." series={d.errorRateSeries} format="pct" xName="Doba" name="Z błędem" annotations={d.annotations} height={200} />
        </Card>
      </div>
      <div className="span-4">
        <Card id="h-ladder" title="Rendycje" sub="Najwyższa jakość osiągnięta w próbie.">
          <BarList items={d.ladder.map((l) => ({ label: l.label, value: l.attempts, share: l.share }))} empty="Bez pomiaru: odtwarzacz nie zgłosił jakości." />
        </Card>
      </div>
      <div className="span-4">
        <Card id="h-errs" title="Błędy odtwarzania wg typu">
          <BarList items={d.errors.map((e) => ({ label: e.label, value: e.attempts, share: e.share, sub: e.fatal ? `w tym krytycznych: ${e.fatal}` : undefined }))} empty="Brak błędów w tym okresie." />
        </Card>
      </div>
      <div className="span-4">
        <EdgeCard edge={edge} now={now} />
      </div>
      <div className="span-12">
        <Notes items={d.notes} />
      </div>
    </div>
  );
}
