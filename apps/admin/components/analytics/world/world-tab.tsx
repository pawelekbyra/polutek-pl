/**
 * "Świat" tab of Analityka (docs/architecture/admin-world-map.md): KPI tiles, the interactive map, the
 * "kraje w czasie" line, the milestones of the conquest and the full table (the accessible form of the map).
 * Server component: it renders the SVG paths once and hands only the small per-country data to the client.
 */
import { countriesWord, type WorldOverview } from "@/lib/modules/admin-analytics";
import { fmtInt, fmtOne } from "@/lib/modules/admin-overview";
import { Badge, Card } from "../../ui";
import { KpiTiles, Notes, RollupAge, SeriesChart } from "../parts";
import { WORLD_HEIGHT, WORLD_POINTS, WORLD_REGIONS, WORLD_WIDTH } from "./geo.generated";
import { WorldMap, type MapCountry } from "./world-map";
import { anchorOf, POINT_RADIUS, WorldSvg } from "./world-svg";

const MILESTONES = 12;

export function WorldTab({ d, cmp, now }: { d: WorldOverview; cmp: boolean; now: Date }) {
  const countries: MapCountry[] = d.countries.map((c) => ({
    code: c.code,
    name: c.name,
    visitors: c.visitors,
    pageviews: c.pageviews,
    share: c.share,
    cls: c.cls,
    firstDay: c.firstDay,
    firstLabel: d.conquest.find((s) => s.day === c.firstDay)?.label ?? null,
    isNew: c.isNew,
    anchor: anchorOf(c.code),
  }));
  const classOf: Record<string, number> = Object.fromEntries(d.countries.map((c) => [c.code, c.cls]));
  const pointCodes = new Set(WORLD_POINTS.map((p) => p.code));
  const withPoint = new Set(d.countries.filter((c) => pointCodes.has(c.code)).map((c) => c.code));
  const active = d.countries.filter((c) => c.visitors > 0);
  const top = active[0];
  const milestones = [...d.conquest].reverse();
  const summary = top
    ? `${active.length} ${countriesWord(active.length)} w okresie; najwięcej odwiedzających: ${top.name} (${fmtInt(top.visitors)}, ${Math.round(top.share)}%).`
    : "W tym okresie nie ma odwiedzających ze znanym krajem.";

  return (
    <div className="grid">
      <div className="span-12">
        <KpiTiles kpis={d.kpis} compare={cmp} context={d.compareLabel} label={`Świat, ${d.rangeLabel}`} />
      </div>
      <div className="span-12">
        <Card id="h-world" title="Mapa świata" meta={<RollupAge rollupAt={d.freshness.rollupAt} now={now} />} sub="Kolor kraju to liczba odwiedzających w okresie; „Podbój świata” odtwarza dni, w których pojawiły się kolejne kraje.">
          <figure className="chart">
            <WorldMap
              countries={countries}
              classes={d.classes}
              steps={d.conquest.map((s) => ({ ...s, totalLabel: `${fmtInt(s.total)} ${countriesWord(s.total)}` }))}
              regions={WORLD_REGIONS}
              width={WORLD_WIDTH}
              height={WORLD_HEIGHT}
              pointRadius={POINT_RADIUS}
              rangeLabel={d.rangeLabel}
              unknownVisitors={d.unknownVisitors}
            >
              <WorldSvg classOf={classOf} withPoint={withPoint} />
            </WorldMap>
            <figcaption className="chart-cap">{summary} Małe kraje i wyspy są kropkami. Granice według stanowiska ONZ (Natural Earth, modyfikacja Visionscarto).</figcaption>
            <details className="chart-table">
              <summary>Tabela krajów ({d.countries.length})</summary>
              <div className="table-scroll">
                <table className="table table-compact">
                  <caption className="sr-only">Kraje: odwiedzający w okresie i dzień pierwszej wizyty</caption>
                  <thead>
                    <tr>
                      <th scope="col">Kraj</th>
                      <th scope="col" className="num">Odwiedzający</th>
                      <th scope="col" className="num">Odsłony</th>
                      <th scope="col" className="num">Udział</th>
                      <th scope="col">Pierwszy raz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.map((c) => (
                      <tr key={c.code}>
                        <th scope="row">
                          {c.name} <span className="muted">{c.code}</span>
                        </th>
                        <td className="num">{c.visitors > 0 ? fmtInt(c.visitors) : "—"}</td>
                        <td className="num">{c.visitors > 0 ? fmtInt(c.pageviews) : "—"}</td>
                        <td className="num">{c.visitors > 0 ? `${fmtOne(c.share)}%` : "—"}</td>
                        <td>
                          {c.firstLabel ?? "—"} {c.isNew ? <Badge kind="info" icon={false}>nowy</Badge> : null}
                        </td>
                      </tr>
                    ))}
                    {d.unknownVisitors > 0 ? (
                      <tr>
                        <th scope="row">Nieznany kraj</th>
                        <td className="num">{fmtInt(d.unknownVisitors)}</td>
                        <td className="num">—</td>
                        <td className="num">—</td>
                        <td>—</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </details>
          </figure>
        </Card>
      </div>
      <div className="span-7">
        <Card id="h-world-line" title="Kraje w czasie" sub="Ile różnych krajów widzieliśmy łącznie od początku pomiaru.">
          <SeriesChart title="Kraje w czasie" summary="Liczba krajów, z których był choć jeden odwiedzający, narastająco od pierwszego dnia telemetrii." series={d.conquestSeries} format="int" xName="Doba" name="Kraje" height={200} tableStep={d.conquestSeries.labels.length > 60 ? 7 : 1} />
        </Card>
      </div>
      <div className="span-5">
        <Card id="h-world-steps" title="Kamienie milowe" sub="Dni, w których pojawiły się nowe kraje (najnowsze u góry).">
          {milestones.length ? (
            <ol className="wm-milestones">
              {milestones.slice(0, MILESTONES).map((s) => (
                <li key={s.day}>
                  <span className="wm-ms-day">{s.label}</span>
                  <span className="wm-ms-names">{s.names.join(", ")}</span>
                  <span className="wm-ms-total">{fmtInt(s.total)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Bez pomiaru: jeszcze żaden kraj nie został zarejestrowany.</p>
          )}
          {milestones.length > MILESTONES ? <p className="limit-note">Starsze dni: w tabeli krajów (kolumna „Pierwszy raz”).</p> : null}
        </Card>
      </div>
      <div className="span-12">
        <Notes items={d.notes} />
      </div>
    </div>
  );
}
