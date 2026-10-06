import type { Metadata } from "next";
import Link from "next/link";
import {
  fmtDateTime,
  fmtInt,
  fmtLongDay,
  fmtRelative,
  fmtTime,
  getTodayOverview,
  getServerHeadroom,
  parseCompare,
  parseRange,
  type EncodeJobDto,
  type StateKind,
  type TodayOverview,
} from "@/lib/modules/admin-overview";
import { ColumnChart } from "@admin/components/column-chart";
import { Icon } from "@admin/components/icons";
import { RefreshButton } from "@admin/components/refresh-button";
import { Age, Badge, Card, Check, Delta, Empty, ExternalLink, Meter, PageHead, Tile } from "@admin/components/ui";
import { overviewDeps } from "@admin/lib/overview";
import { ServerHeadroomCard } from "@admin/components/server-headroom";

export const metadata: Metadata = { title: "Dzisiaj" };

const LOAD_TEST_DOC = "https://github.com/pawelekbyra/polutek-pl/blob/main/docs/operations/LOAD-TEST.md";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const JOB_STATE: Record<EncodeJobDto["status"], [StateKind, string]> = {
  QUEUED: ["info", "W kolejce"],
  RUNNING: ["info", "W toku"],
  SUCCEEDED: ["ok", "Gotowe"],
  FAILED: ["crit", "Błąd"],
  CANCELLED: ["warn", "Anulowane"],
};

const STAGE: Record<string, string> = {
  QUEUED: "czeka",
  DOWNLOADING: "pobieranie oryginału",
  PROBING: "analiza (ffprobe)",
  ENCODING: "kodowanie",
  UPLOADING: "wysyłka do R2",
  FINALIZING: "aktywacja trasy",
  DONE: "gotowe",
};

function bannerClass(kind: StateKind) {
  return kind === "ok" ? "ok" : kind === "crit" ? "crit" : kind === "warn" ? "warn" : "";
}

function HealthBanner({ o, now }: { o: TodayOverview; now: Date }) {
  const h = o.health;
  const total = h.counts.ok + h.counts.warn + h.counts.crit;
  return (
    <div className={`banner ${bannerClass(h.kind)}`} role="status">
      <Icon name={h.kind === "crit" ? "crit" : h.kind === "warn" ? "warn" : "ok"} />
      <div className="banner-body">
        <span className="banner-title">{h.headline}</span>
        <span className="text-2 age-row">
          {h.counts.ok} z {total} kontroli OK{h.counts.info ? ` · ${h.counts.info} bez pomiaru` : ""} · <Age at={h.measuredAt} everyMin={1} source="kontrole panelu" now={now} />
        </span>
      </div>
      <Link className="btn btn-sm" href="/system">
        Centrum zdrowia
      </Link>
    </div>
  );
}

export default async function TodayPage({ searchParams }: Props) {
  const sp = await searchParams;
  const range = parseRange(one(sp.range));
  const compare = parseCompare(one(sp.cmp));
  const deps = overviewDeps();
  const [o, headroom] = await Promise.all([getTodayOverview(deps, { range, compare }), getServerHeadroom(deps)]);
  const now = new Date(o.generatedAt);
  const ctx = compare === "none" ? "" : o.compareLabel;
  const rank: Record<StateKind, number> = { crit: 0, warn: 1, info: 2, ok: 3 };
  const problems = o.health.checks.filter((c) => c.kind !== "ok").sort((a, b) => rank[a.kind] - rank[b.kind]);

  return (
    <>
      <PageHead title="Dzisiaj" lede={`${fmtLongDay(now)} · ${o.rangeLabel}${ctx ? `, ${ctx}` : ""}`} actions={<RefreshButton />} />
      <div className="grid">
        <div className="span-12">
          <HealthBanner o={o} now={now} />
        </div>

        <div className="span-12">
          <div className="tiles tiles-6" role="group" aria-label={`Najważniejsze liczby, ${o.rangeLabel}`}>
            {o.kpis.map((k) => (
              <Tile
                key={k.key}
                label={k.label}
                hint={k.hint}
                value={fmtInt(k.value)}
                unit={k.unit}
                spark={k.spark.length > 3 ? k.spark : undefined}
                delta={<Delta current={k.value} previous={compare === "none" ? null : k.previous} upIsGood={k.upIsGood} context={ctx} />}
              />
            ))}
          </div>
        </div>

        <div className="span-8 stack">
          <Card
            id="h-triage"
            title={`Wymaga uwagi${o.triage.length ? ` (${o.triage.length})` : ""}`}
            meta={<span className="muted">akcje otwierają stary panel do fazy 4</span>}
          >
            {o.triage.length ? (
              <ul className="list">
                {o.triage.map((t) => (
                  <li key={t.id}>
                    <span className={`li-icon ${t.kind}`}>
                      <Icon name={t.icon} />
                    </span>
                    <div className="li-main">
                      <span className="li-title">{t.title}</span>
                      <span className="li-sub">{t.detail}</span>
                    </div>
                    <span className="sr-only">{t.kind === "crit" ? "Pilne" : "Uwaga"}</span>
                    {t.link ? (
                      <div className="li-actions">
                        <ExternalLink className="btn btn-sm" href={t.link.href}>
                          {t.link.label}
                        </ExternalLink>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Nic nie czeka na decyzję">Spory, nieudane kodowania, zgłoszenia i błędy webhooków pojawią się tutaj.</Empty>
            )}
          </Card>

          <Card id="h-tips" title="Napiwki" meta={<span className="muted">{o.rangeLabel}</span>}>
            <ColumnChart
              title="Napiwki"
              summary={`Razem ${fmtInt(o.chart.total)} zł netto (${o.rangeLabel}), w PLN po kursie orientacyjnym.${o.chart.total === 0 ? " W tym okresie nie było wpłat." : ""}`}
              labels={o.chart.labels}
              values={o.chart.values}
              seriesName="Napiwki netto"
              xName={range === "today" ? "Godzina" : "Dzień"}
              format="pln"
              height={200}
            />
          </Card>

          <Card id="h-activity" title="Aktywność" meta={<span className="age"><Icon name="clock" />ostatnie zdarzenia</span>} sub="wpłaty, nowe konta, komentarze, akcje w panelach">
            {o.activity.length ? (
              <ul className="list feed">
                {o.activity.map((a) => (
                  <li key={a.id}>
                    <time dateTime={a.at}>{fmtTime(a.at)}</time>
                    <span className={`li-icon ${a.kind}`}>
                      <Icon name={a.icon} />
                    </span>
                    <div className="li-main">
                      <span className="li-title">{a.title}</span>
                      <span className="li-sub">
                        {fmtRelative(a.at, now)} · {a.detail}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="info" title="Jeszcze nic się nie wydarzyło" />
            )}
          </Card>
        </div>

        <div className="span-4 stack">
          <ServerHeadroomCard h={headroom} compact loadTestHref={LOAD_TEST_DOC} />
          <Card id="h-limits" title="Limity serwera" meta={o.limits[0] ? <Age at={o.limits[0].measuredAt} everyMin={1} source={o.limits[0].source} now={now} /> : null}>
            {o.limits.map((l) => (
              <div className="limit" key={l.id}>
                <div className="limit-head">
                  <span className="limit-name">{l.label}</span>
                  <span className="limit-val">{l.valueText}</span>
                </div>
                {l.percent !== null ? <Meter percent={l.percent} label={l.label} valueText={l.valueText} warnAt={l.warnAt} critAt={l.critAt} /> : null}
                <span className="limit-note">{l.note}</span>
              </div>
            ))}
            <p className="limit-note">Worker HLS i R2: liczniki przyjdą z kolektora (faza 0).</p>
          </Card>

          <Card id="h-system" title="Stan systemu" meta={<Link href="/system">Wszystkie <Icon name="right" /></Link>}>
            <div className="checks">
              {(problems.length ? problems.slice(0, 5) : o.health.checks.slice(0, 5)).map((c) => (
                <Check key={c.id} kind={c.kind} title={c.label} sub={c.detail} />
              ))}
            </div>
          </Card>

          <Card id="h-jobs" title="Kolejka kodowania">
            {o.encodeQueue.length ? (
              <ul className="list">
                {o.encodeQueue.map((j) => {
                  const [kind, word] = JOB_STATE[j.status];
                  return (
                    <li key={j.id}>
                      <div className="li-main">
                        <span className="li-title">{j.videoTitle}</span>
                        <span className="li-sub">
                          {j.status === "RUNNING" ? `${STAGE[j.stage] ?? j.stage} · ${j.progress}%` : j.status === "FAILED" ? j.failure ?? "bez opisu" : j.finishedAt ? fmtDateTime(j.finishedAt, now) : fmtRelative(j.createdAt, now)}
                          {j.attempt > 1 ? ` · próba ${j.attempt} z ${j.maxAttempts}` : ""}
                        </span>
                      </div>
                      <Badge kind={kind} icon={kind === "info" ? "clock" : undefined}>
                        {word}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="Kolejka pusta">Nowe kodowania pojawią się tu po wgraniu oryginału.</Empty>
            )}
          </Card>

          <Card id="h-next" title="Nadchodzi">
            {o.upcoming.length ? (
              <ul className="list">
                {o.upcoming.map((u) => (
                  <li key={u.id}>
                    <span className={`li-icon ${u.kind}`}>
                      <Icon name={u.icon} />
                    </span>
                    <div className="li-main">
                      <span className="li-title">{u.title}</span>
                      <span className="li-sub">{u.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="calendar" title="Nic zaplanowanego">Premiery i zaplanowane rozsyłki pojawią się tutaj.</Empty>
            )}
          </Card>
        </div>
      </div>
      <p className="foot-note">
        <Icon name="info" />
        Dane z bazy w chwili otwarcia ekranu ({fmtTime(now)}, czas warszawski). Panel w fazie 1 tylko czyta; ruch i jakość odtwarzania dojdą w fazie 2 (telemetria).
      </p>
    </>
  );
}
