"use client";
/**
 * Live premiere monitor: numbers refreshed by Server-Sent Events (/api/live). WCAG 2.2.2: "Wstrzymaj odświeżanie"
 * closes the stream and freezes the numbers until "Wznów". The numbers are not announced on every update
 * (aria-live off); only connection changes are announced. A silent stream (no event for 15 s) is shown as a warning.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LiveSnapshot } from "@/lib/modules/admin-analytics";
import { ColumnChart } from "../column-chart";
import { Icon } from "../icons";

type Status = "connecting" | "live" | "retrying" | "paused";
const STALE_AFTER_MS = 15_000;
const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const warsawTime = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const warsawMinute = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });
const none = "bez pomiaru";

/** Local copies of the Card/Meter/State markup: ui.tsx imports server-only modules and must not enter the browser bundle. */
function Card({ id, title, meta, sub, children }: { id: string; title: string; meta?: ReactNode; sub?: string; children: ReactNode }) {
  return (
    <section className="card" aria-labelledby={id}>
      <div className="card-head">
        <h2 id={id}>{title}</h2>
        {meta}
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Meter({ percent, label, valueText, warnAt, critAt }: { percent: number; label: string; valueText: string; warnAt: number; critAt: number }) {
  const state = percent >= critAt ? "crit" : percent >= warnAt ? "warn" : "ok";
  return (
    <div className={`meter meter-${state}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={label} aria-valuetext={valueText}>
      <div className={`meter-fill pw-${Math.max(0, Math.min(100, Math.round(percent)))}`} />
      <div className={`meter-threshold pl-${warnAt}`} aria-hidden="true" />
    </div>
  );
}

const STATE_ICON = { ok: "ok", warn: "warn", crit: "crit", info: "info" } as const;
const STATE_WORD = { ok: "OK", warn: "Uwaga", crit: "Błąd", info: "Info" } as const;
function State({ kind, children }: { kind: keyof typeof STATE_ICON; children: ReactNode }) {
  return (
    <span className={`state ${kind}`}>
      <Icon name={STATE_ICON[kind]} />
      <span>
        <span className="sr-only">{STATE_WORD[kind]}: </span>
        {children}
      </span>
    </span>
  );
}

export function isSnapshot(v: unknown): v is LiveSnapshot {
  return !!v && typeof v === "object" && typeof (v as LiveSnapshot).at === "string" && Array.isArray((v as LiveSnapshot).perMinute);
}

const STATUS_TEXT: Record<Status, string> = {
  connecting: "łączenie…",
  live: "na żywo, odświeżanie co kilka sekund",
  retrying: "połączenie przerwane, ponawiam",
  paused: "wstrzymane",
};

export function LiveMonitor({ initial, videoKey }: { initial: LiveSnapshot; videoKey: string }) {
  const [snap, setSnap] = useState<LiveSnapshot>(initial);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<Status>("connecting");
  const [quiet, setQuiet] = useState(false);
  const lastEvent = useRef(0);

  useEffect(() => {
    if (paused) return;
    lastEvent.current = Date.now();
    const es = new EventSource(`/api/live${videoKey ? `?video=${encodeURIComponent(videoKey)}` : ""}`);
    es.addEventListener("snapshot", (e) => {
      try {
        const data: unknown = JSON.parse((e as MessageEvent<string>).data);
        if (isSnapshot(data)) {
          setSnap(data);
          setStatus("live");
          setQuiet(false);
          lastEvent.current = Date.now();
        }
      } catch {
        // a malformed event is ignored; the next one replaces it
      }
    });
    es.onerror = () => setStatus("retrying");
    const watch = setInterval(() => setQuiet(Date.now() - lastEvent.current > STALE_AFTER_MS), 5_000);
    return () => {
      es.close();
      clearInterval(watch);
    };
  }, [paused, videoKey]);

  const shown: Status = paused ? "paused" : status;
  const last = snap.perMinute;
  const viewers = last.map((m) => m.viewers);
  const labels = last.map((m) => warsawMinute.format(new Date(m.minute)));
  const peakText = snap.viewersPeak === null ? none : `szczyt ${nf.format(snap.viewersPeak)}`;
  const startupKind = snap.startupP95Ms === null ? "info" : snap.startupP95Ms <= 2000 ? "ok" : snap.startupP95Ms <= 4000 ? "warn" : "crit";
  const forecast = snap.workerForecast;

  return (
    <>
      <div className="row-between live-bar">
        <span className="live-status">
          <span className={`live-pill${paused ? " is-paused" : ""}`}>
            <span className="pulse" aria-hidden="true" />
            {paused ? "Wstrzymane" : "Na żywo"}
          </span>
          <span>
            {STATUS_TEXT[shown]} · dane z {warsawTime.format(new Date(snap.at))}
          </span>
          {quiet && !paused ? (
            <span className="state warn">
              <Icon name="warn" />
              <span>od 15 s brak nowych danych</span>
            </span>
          ) : null}
        </span>
        <button type="button" className="btn" aria-pressed={paused} onClick={() => {
            if (paused) setStatus("connecting");
            setPaused((p) => !p);
          }}>
          <Icon name={paused ? "refresh" : "clock"} />
          <span>{paused ? "Wznów odświeżanie" : "Wstrzymaj odświeżanie"}</span>
        </button>
      </div>
      <span className="sr-only" role="status">
        {STATUS_TEXT[shown]}
      </span>

      {forecast ? (
        <div className="banner" role="note">
          <Icon name="info" />
          <div className="banner-body">
            <span className="banner-title">
              Worker HLS: {nf.format(forecast.used)} z {nf.format(forecast.limit)} żądań dziś
            </span>
            <span className="text-2">{forecast.reason}</span>
          </div>
        </div>
      ) : null}

      <div className="live-grid" aria-live="off">
        <div className="card live-num">
          <span className="tile-label">Widzowie teraz</span>
          <span className="hero-num">{snap.viewersNow === null ? <span className="nomeasure">{none}</span> : nf.format(snap.viewersNow)}</span>
          <span className="delta-ctx">{peakText}</span>
        </div>
        <div className="card live-num">
          <span className="tile-label">Czas startu p95 (5 min)</span>
          <span className="hero-num">{snap.startupP95Ms === null ? <span className="nomeasure">{none}</span> : `${nf1.format(snap.startupP95Ms / 1000)} s`}</span>
          {snap.startupP95Ms === null ? <span className="delta-ctx">brak startów w 5 minutach</span> : <State kind={startupKind}>{startupKind === "ok" ? "poniżej celu 2 s" : startupKind === "warn" ? "powyżej celu 2 s" : "wolno"}</State>}
        </div>
        <div className="card live-num">
          <span className="tile-label">Błędy odtwarzania / min</span>
          <span className="hero-num">{snap.errorsLastMinute === null ? <span className="nomeasure">{none}</span> : nf.format(snap.errorsLastMinute)}</span>
          <span className="delta-ctx">{snap.errorShare5mPct === null ? "bez próby w 5 minutach" : `${nf1.format(snap.errorShare5mPct)}% prób w 5 minutach`}</span>
        </div>
        <div className="card live-num">
          <span className="tile-label">Serwer: CPU / RAM</span>
          <span className="hero-num">{snap.server?.cpuLoadPct == null ? <span className="nomeasure">{none}</span> : `${snap.server.cpuLoadPct}%`}</span>
          <span className="delta-ctx">{snap.server ? `RAM ${snap.server.memUsedPct ?? "?"}% · swap ${snap.server.swapUsedPct ?? "?"}%` : "bez pomiaru hosta"}</span>
        </div>
      </div>

      <div className="grid live-body">
        <div className="span-8 stack">
          <Card id="h-lc" title="Widzowie w ostatnich 30 minutach" meta={<span className="age"><Icon name="clock" />co 3 s</span>}>
            {last.length ? (
              <ColumnChart title="Widzowie w ostatnich 30 minutach" summary={`Unikalni widzowie z sygnałem odtwarzania w każdej minucie; teraz ${snap.viewersNow ?? 0}.`} labels={labels} values={viewers} seriesName="Widzowie" xName="Minuta" format="int" height={160} />
            ) : (
              <p className="muted">Bez pomiaru: telemetria nie odpowiada.</p>
            )}
          </Card>
        </div>
        <div className="span-4 stack">
          <Card id="h-lt" title="Od startu premiery" sub="Napiwki i komentarze liczone od czasu premiery (albo z ostatniej godziny, gdy premiery nie ma).">
            <dl className="kv">
              <dt>Napiwki</dt>
              <dd className="tabular">{snap.tips === null ? none : snap.tips.currency ? `${nf.format(snap.tips.count)} · ${nf1.format(snap.tips.totalMinor / 100)} ${snap.tips.currency.toUpperCase()}` : `${nf.format(snap.tips.count)}`}</dd>
              <dt>Komentarze</dt>
              <dd className="tabular">{snap.comments === null ? none : nf.format(snap.comments.count)}</dd>
              <dt>Odsłony / min</dt>
              <dd className="tabular">{snap.pageviewsLastMinute === null ? none : nf.format(snap.pageviewsLastMinute)}</dd>
            </dl>
          </Card>
          {forecast ? (
            <Card id="h-lw" title="Worker HLS">
              <Meter percent={Math.min(100, (100 * forecast.used) / forecast.limit)} label="Zużycie dziennego limitu Workera HLS" valueText={`${nf.format(forecast.used)} z ${nf.format(forecast.limit)} żądań`} warnAt={70} critAt={90} />
            </Card>
          ) : null}
        </div>
      </div>
      {snap.notes.length ? (
        <ul className="notes">
          {snap.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
