/**
 * "Zapas serwera": the busiest minute of real traffic against the measured limit of the server
 * (lib/modules/admin-overview/domain/server-capacity.config.ts, docs/operations/LOAD-TEST.md).
 */
import { fmtInt, fmtOne, fmtPercent, type ServerHeadroom } from "@/lib/modules/admin-overview";
import { Icon } from "./icons";
import { Badge, Card, Meter, State } from "./ui";

const WINDOW_LABEL = { h1: "1 h", h24: "24 h", d7: "7 dni" } as const;
const KIND_WORD = { ok: "duży zapas", warn: "połowa granicy", crit: "blisko granicy", info: "" } as const;
const perSec = (v: number | null) => (v === null ? "—" : `${fmtOne(v)}/s`);
const thousands = (v: number) => (v >= 10_000 ? `ok. ${fmtInt(Math.round(v / 1000))} tys.` : fmtInt(v));

export function ServerHeadroomCard({ h, compact, loadTestHref }: { h: ServerHeadroom; compact?: boolean; loadTestHref: string }) {
  const c = h.capacity;
  const foot = (
    <>
      <span className="muted">
        {c.server}, pomiar {c.measuredAt}
      </span>
      <a href={loadTestHref} target="_blank" rel="noopener noreferrer">
        Test obciążenia <Icon name="external" />
        <span className="sr-only"> (otwiera dokument w nowej karcie)</span>
      </a>
    </>
  );
  if (h.state !== "ok") {
    return (
      <Card id={compact ? "h-headroom-c" : "h-headroom"} title="Zapas serwera" foot={foot}>
        <div className="unavailable" role="note">
          <Icon name="info" />
          <div>
            <strong>Brak danych o ruchu.</strong> {h.reason}
            <div className="muted">
              Granica z testu: {fmtOne(c.limitPerSec)} wizyt/s, komfortowo {fmtOne(c.comfortablePerSec)}/s.
            </div>
          </div>
        </div>
      </Card>
    );
  }
  const pct = h.usage * 100;
  const valueText = `Szczyt ${WINDOW_LABEL[h.basis]}: ${fmtOne(h.peakPerSec)} wizyt na sekundę z ${fmtOne(c.limitPerSec)} granicy, zapas ${fmtPercent(h.headroom * 100)}`;
  return (
    <Card
      id={compact ? "h-headroom-c" : "h-headroom"}
      title="Zapas serwera"
      meta={<Badge kind={h.kind}>{`zapas ${fmtPercent(h.headroom * 100)}`}</Badge>}
      foot={foot}
    >
      <div className="stack-sm">
        <div className="limit-head">
          <span className="limit-name">
            Szczyt {WINDOW_LABEL[h.basis]}: {fmtOne(h.peakPerSec)} wizyt/s z {fmtOne(c.limitPerSec)} granicy
          </span>
          <span className="limit-val">{fmtPercent(pct)}</span>
        </div>
        <Meter percent={Math.min(100, pct)} label="Zapas serwera" valueText={valueText} warnAt={50} critAt={80} />
        <span className="limit-note">
          <State kind={h.kind}>{KIND_WORD[h.kind]}</State> · komfortowo do {fmtOne(c.comfortablePerSec)}/s (95% wizyt w {fmtInt(c.comfortableP95Ms)} ms)
        </span>
        {!h.enoughData ? (
          <p className="limit-note">
            <Icon name="warn" /> Za mało danych: telemetria zbiera od {fmtOne(h.coverageHours)} h, pełny obraz po 24 h i po 7 dniach.
          </p>
        ) : null}
        <p className={`headroom-advice ${h.kind}`}>{h.recommendation}</p>
        {compact ? null : (
          <>
            <table className="table table-compact">
              <caption className="sr-only">Szczyty ruchu w oknach czasu</caption>
              <thead>
                <tr>
                  <th scope="col">Okno</th>
                  <th scope="col" className="num">Najmocniejsza minuta</th>
                  <th scope="col" className="num">Najmocniejsza sekunda</th>
                </tr>
              </thead>
              <tbody>
                {(["h1", "h24", "d7"] as const).map((w) => (
                  <tr key={w}>
                    <th scope="row">{WINDOW_LABEL[w]}</th>
                    <td className="num">{perSec(h.windows[w].perSec)}</td>
                    <td className="num">{h.windows[w].peakSecond === null ? "—" : `${fmtInt(h.windows[w].peakSecond)} odsłon`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              Ostatnie 24 h: {fmtInt(h.views24h)} odsłon. Granica odpowiada {thousands(h.dailyAtLimit)} odsłon dziennie, komfortowo {thousands(h.dailyComfortable)} (gdy najgorsza godzina to ok. {fmtPercent(c.peakHourShare * 100)} doby). Wizyta = strona główna, lista filmów, komentarze, plan odtwarzania i miniatura; jedna odsłona liczy się jak jedna wizyta.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
