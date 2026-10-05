/** Quality screens shared by the Analityka tab and the per-film "Jakość" tab. */
import { type EdgeSnapshot, type QualityOverview } from "@/lib/modules/admin-analytics";
import { fmtInt, fmtOne } from "@/lib/modules/admin-overview";
import { Icon } from "../icons";
import { Card, Meter, Tile } from "../ui";
import { LowSample, UnavailableCard } from "./parts";

export function QualityTiles({ d }: { d: QualityOverview }) {
  const s = d.summary;
  const none = s.attempts === 0;
  const tile = (label: string, value: string | null, unit: string | undefined, hint?: string) => <Tile label={label} hint={hint} value={value === null || none ? <span className="nomeasure">bez pomiaru</span> : value} unit={value === null || none ? undefined : unit} delta={undefined} />;
  return (
    <>
      {s.sample === "low" ? <LowSample>Mała próba: n = {s.attempts} prób odtworzenia. Liczby jakości są orientacyjne.</LowSample> : null}
      <div className="tiles" role="group" aria-label="Jakość odtwarzania">
        {tile("Wynik doświadczenia widza", s.experienceScore === null ? null : fmtInt(s.experienceScore), "/100", "Średnia z trzech wyników: start 8/(8+s), płynność i brak błędu krytycznego (formuły Mux Data, wagi nasze).")}
        {tile("Czas startu p50 / p95", d.startupP95Ms === null ? null : `${fmtOne((d.startupP50Ms ?? 0) / 1000)} / ${fmtOne(d.startupP95Ms / 1000)}`, "s", `Z ${d.startupN} startów; dokładność do szerokości przedziału histogramu.`)}
        {tile("Wyjścia przed startem", s.exitBeforeStartPct === null ? null : fmtOne(s.exitBeforeStartPct), "%", "Próby, w których widz odszedł przed pierwszą klatką.")}
        {tile("Błędy odtwarzania", s.errorPct === null ? null : fmtOne(s.errorPct), "%", "Próby z jakimkolwiek błędem (krytycznych osobno: " + (s.fatalErrorPct === null ? "bez pomiaru" : `${fmtOne(s.fatalErrorPct)}%`) + ").")}
        {tile("Buforowanie", s.rebufferPct === null ? null : fmtOne(s.rebufferPct), "% czasu", "Czas zatrzymań jako część czasu oglądania.")}
      </div>
      <p className="limit-note">
        {s.avgBitrateKbps !== null ? `Średni bitrate: ${fmtInt(s.avgBitrateKbps)} kb/s · ` : ""}
        {s.switchesPerAttempt !== null ? `przełączeń jakości na start: ${fmtOne(s.switchesPerAttempt)} · ` : ""}
        {s.rebufferedAttemptsPct !== null ? `starty z buforowaniem: ${fmtOne(s.rebufferedAttemptsPct)}%` : ""}
      </p>
    </>
  );
}

export function EdgeCard({ edge, now }: { edge: EdgeSnapshot; now: Date }) {
  if (!edge.available)
    return (
      <Card id="h-edge" title="Worker HLS i krawędź video.">
        <UnavailableCard reason={edge.reason} />
      </Card>
    );
  const pct = edge.workerRequests !== null ? (100 * edge.workerRequests) / edge.workerLimit : null;
  return (
    <Card id="h-edge" title="Worker HLS i krawędź video." meta={<span className="age"><Icon name="clock" />dane z {edge.fetchedAt.slice(11, 16)} UTC</span>}>
      <div className="stack-sm">
        {pct !== null ? (
          <>
            <div className="limit-head">
              <span className="limit-name">Żądania Workera dziś (UTC)</span>
              <span className="limit-val">{fmtInt(edge.workerRequests ?? 0)} / {fmtInt(edge.workerLimit)}</span>
            </div>
            <Meter percent={Math.min(100, pct)} label="Zużycie dziennego limitu Workera HLS" valueText={`${fmtInt(edge.workerRequests ?? 0)} z ${fmtInt(edge.workerLimit)} żądań`} warnAt={70} critAt={90} />
          </>
        ) : (
          <p className="muted">Worker HLS: bez pomiaru.</p>
        )}
        <dl className="kv">
          <dt>Cache hit</dt>
          <dd className="tabular">{edge.cacheHitPct === null ? "bez pomiaru" : `${fmtOne(edge.cacheHitPct)}%`}</dd>
          <dt>403 (token)</dt>
          <dd className="tabular">{edge.status403 === null ? "bez pomiaru" : fmtInt(edge.status403)}</dd>
          <dt>404 (segmenty)</dt>
          <dd className="tabular">{edge.status404 === null ? "bez pomiaru" : fmtInt(edge.status404)}</dd>
          <dt>5xx</dt>
          <dd className="tabular">{edge.status5xx === null ? "bez pomiaru" : fmtInt(edge.status5xx)}</dd>
        </dl>
      </div>
      <span className="sr-only">{now.toISOString()}</span>
    </Card>
  );
}

