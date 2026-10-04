import type { Metadata } from "next";
import Link from "next/link";
import {
  STATE_WORD,
  fmtBytes,
  fmtDateTime,
  fmtDuration,
  fmtOne,
  fmtPercent,
  fmtRelative,
  getSystemOverview,
  type SystemOverview,
} from "@/lib/modules/admin-overview";
import { Icon } from "@admin/components/icons";
import { RefreshButton } from "@admin/components/refresh-button";
import { Age, Badge, Card, Empty, ExternalLink, Meter, PageHead, State, Tile } from "@admin/components/ui";
import { overviewDeps } from "@admin/lib/overview";

export const metadata: Metadata = { title: "System" };

const TABS = [
  ["zdrowie", "Zdrowie i kolejki"],
  ["serwer", "Serwer i kontenery"],
  ["zadania", "Zadania i kopie"],
  ["domeny", "Domeny, baza, koszty"],
] as const;
type Tab = (typeof TABS)[number][0];

function Unavailable({ reason, source }: { reason: string; source: string }) {
  return (
    <div className="unavailable" role="note">
      <Icon name="info" />
      <div>
        <strong>Brak danych.</strong> {reason}
        <div className="muted">Źródło: {source}. Jak włączyć: docs/operations/ADMIN-PANEL.md, „Status hosta”.</div>
      </div>
    </div>
  );
}

function HealthTab({ s, now }: { s: SystemOverview; now: Date }) {
  const h = s.health;
  return (
    <div className="grid">
      <div className="span-12">
        <Card
          id="h-hc"
          title="Centrum zdrowia"
          flush
          meta={<span className="muted">{h.counts.ok} OK · {h.counts.warn} uwaga · {h.counts.crit} błąd{h.counts.info ? ` · ${h.counts.info} bez pomiaru` : ""}</span>}
          sub="Liczone przy każdym otwarciu ekranu; sondy usług (strona, Redis, Worker HLS) pamiętane do 60 s. Strażnik z zewnątrz (gdy padnie cały serwer) dojdzie w fazie 0."
        >
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Kontrole zdrowia</caption>
              <thead>
                <tr>
                  <th scope="col">Kontrola</th>
                  <th scope="col">Stan</th>
                  <th scope="col">Szczegóły</th>
                  <th scope="col">Pomiar</th>
                </tr>
              </thead>
              <tbody>
                {h.checks.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-first" data-label="Kontrola">
                      <strong>{c.label}</strong>
                    </td>
                    <td data-label="Stan">
                      <State kind={c.kind}>{c.kind === "info" ? "Bez pomiaru" : STATE_WORD[c.kind]}</State>
                    </td>
                    <td className="wrap" data-label="Szczegóły">
                      {c.detail}
                      {c.link ? (
                        <>
                          {" "}
                          <ExternalLink href={c.link.href}>{c.link.label}</ExternalLink>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Pomiar">
                      <Age at={c.measuredAt} everyMin={c.everyMin} source={c.source} now={now} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="span-12">
        <Card id="h-queues" title="Kolejki" flush>
          <ul className="list list-pad">
            {s.queues.map((q) => (
              <li key={q.id}>
                <span className={`li-icon ${q.kind === "ok" ? "" : q.kind}`}>
                  <Icon name={q.kind === "ok" ? "inbox" : q.kind === "crit" ? "crit" : "warn"} />
                </span>
                <div className="li-main">
                  <span className="li-title">
                    {q.label}: {q.pending}
                  </span>
                  <span className="li-sub">{q.detail}</span>
                </div>
                {q.link ? (
                  <ExternalLink className="btn btn-sm btn-ghost" href={q.link.href}>
                    {q.link.label}
                  </ExternalLink>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ServerTab({ s, now }: { s: SystemOverview; now: Date }) {
  const h = s.host;
  const p = s.process;
  return (
    <div className="grid">
      <div className="span-12">
        {h.available ? (
          <div className="tiles" role="group" aria-label="Serwer teraz">
            <Tile label={`CPU (${h.cpuCount} vCPU)`} value={fmtOne(h.load[0])} unit="load 1 min" delta={<span className="delta-ctx">5 min {fmtOne(h.load[1])} · 15 min {fmtOne(h.load[2])}</span>} />
            <Tile label="RAM zajęty" value={fmtBytes(h.memTotalBytes - h.memAvailableBytes)} unit={`/ ${fmtBytes(h.memTotalBytes)}`} delta={<span className="delta-ctx">dostępne {fmtBytes(h.memAvailableBytes)}</span>} />
            <Tile
              label="Swap"
              value={fmtBytes(h.swapUsedBytes)}
              unit={`/ ${fmtBytes(h.swapTotalBytes)}`}
              delta={h.swapTotalBytes && h.swapUsedBytes / h.swapTotalBytes >= 0.25 ? <State kind="warn">powyżej progu 25%</State> : <span className="delta-ctx">próg 25%</span>}
            />
            <Tile label="Dysk" value={fmtPercent((h.diskUsedBytes / h.diskTotalBytes) * 100)} delta={<span className="delta-ctx">{fmtBytes(h.diskUsedBytes)} / {fmtBytes(h.diskTotalBytes)}</span>} />
            <Tile label="Czas pracy hosta" value={fmtDuration(h.uptimeSeconds)} delta={<Age at={h.measuredAt} everyMin={1} source={h.source} now={now} />} />
          </div>
        ) : (
          <Card id="h-host" title="Serwer">
            <Unavailable reason={h.reason} source={h.source} />
          </Card>
        )}
      </div>
      <div className="span-8">
        <Card
          id="h-cont"
          title="Kontenery"
          flush
          meta={s.containers.available ? <Age at={s.containers.measuredAt} everyMin={1} source="plik statusu hosta" now={now} /> : null}
          sub="Bez gniazda Dockera w panelu: stan pisze na hoście zadanie host-status (tylko odczyt, jeden plik JSON)."
        >
          {s.containers.available ? (
            <div className="table-scroll">
              <table className="table responsive">
                <caption className="sr-only">Kontenery Docker</caption>
                <thead>
                  <tr>
                    <th scope="col">Kontener</th>
                    <th scope="col">Stan</th>
                    <th scope="col">RAM / limit</th>
                    <th scope="col" className="num">CPU</th>
                    <th scope="col" className="num">Restarty</th>
                    <th scope="col" className="hide-sm">Obraz</th>
                  </tr>
                </thead>
                <tbody>
                  {s.containers.items.map((c) => {
                    const healthy = c.state === "running" && (c.health === null || c.health === "healthy");
                    const memPct = c.memBytes !== null && c.memLimitBytes ? (c.memBytes / c.memLimitBytes) * 100 : null;
                    return (
                      <tr key={c.name}>
                        <td className="cell-first mono" data-label="Kontener">{c.name}</td>
                        <td data-label="Stan">
                          <State kind={healthy ? "ok" : "crit"}>{healthy ? (c.health ?? c.state) : `${c.state}${c.health ? ` · ${c.health}` : ""}`}</State>
                        </td>
                        <td data-label="RAM / limit">
                          <div className="meter-inline">
                            <span className="tabular">
                              {fmtBytes(c.memBytes)} / {c.memLimitBytes ? fmtBytes(c.memLimitBytes) : "bez limitu"}
                            </span>
                            {memPct !== null ? <Meter percent={memPct} label={`RAM ${c.name}`} valueText={fmtPercent(memPct)} warnAt={80} critAt={95} /> : null}
                          </div>
                        </td>
                        <td className="num" data-label="CPU">{c.cpuPercent !== null ? `${fmtOne(c.cpuPercent)}%` : "—"}</td>
                        <td className="num" data-label="Restarty">{c.restarts ?? "—"}</td>
                        <td className="hide-sm mono" data-label="Obraz">{c.image ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-pad">
              <Unavailable reason={s.containers.reason} source={s.containers.source} />
            </div>
          )}
        </Card>
      </div>
      <div className="span-4">
        <Card id="h-proc" title="Proces panelu">
          <dl className="kv">
            <dt>Pamięć (RSS)</dt>
            <dd className="tabular">
              {fmtBytes(p.rssBytes)}
              {p.memoryLimitBytes ? ` z limitu ${fmtBytes(p.memoryLimitBytes)}` : ""}
            </dd>
            <dt>Sterta JS</dt>
            <dd className="tabular">{fmtBytes(p.heapUsedBytes)}</dd>
            <dt>Działa od</dt>
            <dd>{fmtDuration(p.uptimeSeconds)}</dd>
            <dt>Node.js</dt>
            <dd className="mono">{p.nodeVersion}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function JobsTab({ s, now }: { s: SystemOverview; now: Date }) {
  const b = s.backups;
  return (
    <div className="grid">
      <div className="span-12">
        <Card id="h-tim" title={`Zadania okresowe (${s.jobs.items.length})`} flush meta={s.jobs.measuredAt ? <Age at={s.jobs.measuredAt} everyMin={1} source={s.jobs.source} now={now} /> : <span className="muted">{s.jobs.source}</span>} sub="Harmonogramy z repo. Wynik ostatniego uruchomienia przychodzi z pliku statusu hosta; dziennik job_run i alarm „zadanie się nie zgłosiło” to faza 0.">
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Zadania okresowe</caption>
              <thead>
                <tr>
                  <th scope="col">Zadanie</th>
                  <th scope="col">Harmonogram</th>
                  <th scope="col">Ostatnio</th>
                  <th scope="col" className="hide-sm">Następne</th>
                  <th scope="col">Co robi</th>
                </tr>
              </thead>
              <tbody>
                {s.jobs.items.map((j) => (
                  <tr key={j.name}>
                    <td className="cell-first mono" data-label="Zadanie">{j.name}</td>
                    <td data-label="Harmonogram">{j.schedule}</td>
                    <td data-label="Ostatnio">
                      {j.lastRun ? <State kind={j.lastRun.ok ? "ok" : "crit"}>{fmtDateTime(j.lastRun.at, now)}</State> : <span className="muted">brak danych</span>}
                    </td>
                    <td className="hide-sm" data-label="Następne">{j.nextRun ? fmtDateTime(j.nextRun, now) : <span className="muted">—</span>}</td>
                    <td className="wrap" data-label="Co robi">{j.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-bk" title="Kopie zapasowe" meta={b.available ? <Age at={b.measuredAt} everyMin={1} source="plik statusu hosta" now={now} /> : null}>
          {b.available ? (
            <dl className="kv">
              <dt>Ostatnia kopia</dt>
              <dd>{b.latestAt ? <State kind={now.getTime() - new Date(b.latestAt).getTime() > 26 * 3600_000 ? "crit" : "ok"}>{`${fmtDateTime(b.latestAt, now)} (${fmtRelative(b.latestAt, now)})`}</State> : "brak"}</dd>
              <dt>Rozmiar</dt>
              <dd className="tabular">{fmtBytes(b.latestBytes)}</dd>
              <dt>Lokalnie</dt>
              <dd className="tabular">{b.count} plików</dd>
              <dt>Poza serwerem</dt>
              <dd>{b.offsite}</dd>
            </dl>
          ) : (
            <Unavailable reason={b.reason} source={b.source} />
          )}
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-rt" title="Test odtworzenia">
          <Empty icon="info" title="Jeszcze nie ma automatycznego testu">
            Cotygodniowe odtworzenie kopii na czystym kontenerze i jego wynik to zadanie fazy 0 (decyzja właściciela nr 10).
          </Empty>
        </Card>
      </div>
    </div>
  );
}

function DomainsTab({ s }: { s: SystemOverview }) {
  const db = s.database;
  return (
    <div className="grid">
      <div className="span-7">
        <Card id="h-dom" title="Domeny i certyfikaty" flush sub={`Stan z dokumentacji na ${s.factsAsOf}. Daty z RDAP i alerty przed wygaśnięciem przyjdą z kolektora.`}>
          <ul className="list list-pad">
            {s.domains.map((d) => (
              <li key={d.name}>
                <span className={`li-icon ${d.state === "ok" ? "" : d.state}`}>
                  <Icon name="globe" />
                </span>
                <div className="li-main">
                  <span className="li-title">
                    {d.name} <span className="muted">· {d.kind}</span>
                  </span>
                  <span className="li-sub">
                    {d.note} · źródło: {d.source}
                  </span>
                </div>
                <Badge kind={d.state}>{STATE_WORD[d.state]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="span-5">
        <Card id="h-db" title="Postgres">
          <dl className="kv">
            <dt>Wersja</dt>
            <dd className="mono">{db.version ?? "—"}</dd>
            <dt>Rozmiar bazy</dt>
            <dd className="tabular">{fmtBytes(db.sizeBytes)}</dd>
            <dt>Połączenia</dt>
            <dd className="tabular">
              {db.connections ?? "—"} / {db.maxConnections ?? "—"}
            </dd>
            <dt>Czas odpowiedzi</dt>
            <dd className="tabular">{db.latencyMs !== null ? `${db.latencyMs} ms` : "brak odpowiedzi"}</dd>
            <dt>Wolne zapytania</dt>
            <dd>
              <State kind="info">pg_stat_statements: faza 0</State>
            </dd>
          </dl>
        </Card>
      </div>
      <div className="span-12">
        <Card id="h-cost" title="Koszty miesięczne" flush sub={`Z dokumentacji na ${s.factsAsOf}; panel nie pyta API płatności.`}>
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Koszty</caption>
              <thead>
                <tr>
                  <th scope="col">Pozycja</th>
                  <th scope="col">Miesięcznie</th>
                  <th scope="col">Uwagi</th>
                </tr>
              </thead>
              <tbody>
                {s.costs.map((c) => (
                  <tr key={c.item}>
                    <td className="cell-first" data-label="Pozycja">{c.item}</td>
                    <td className="tabular" data-label="Miesięcznie">{c.monthly}</td>
                    <td className="wrap" data-label="Uwagi">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SystemPage({ searchParams }: Props) {
  const raw = (await searchParams).tab;
  const tab: Tab = (TABS.find(([id]) => id === (Array.isArray(raw) ? raw[0] : raw))?.[0] ?? "zdrowie") as Tab;
  const s = await getSystemOverview(overviewDeps());
  const now = new Date(s.generatedAt);
  const problems = s.health.counts.warn + s.health.counts.crit;
  return (
    <>
      <PageHead title="System" lede="Serwer serwerek (Hetzner CPX22) · Docker Compose za Cloudflare Tunnel" actions={<RefreshButton />} />
      <nav className="tabs" aria-label="Sekcje systemu">
        {TABS.map(([id, label]) => (
          <Link key={id} href={id === "zdrowie" ? "/system" : `/system?tab=${id}`} aria-current={tab === id ? "page" : undefined} scroll={false}>
            {label}
            {id === "zdrowie" && problems ? (
              <span className={`nav-count ${s.health.kind === "crit" ? "crit" : "warn"}`}>
                <span aria-hidden="true">{problems}</span>
                <span className="sr-only">, {problems} do sprawdzenia</span>
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      {tab === "zdrowie" ? <HealthTab s={s} now={now} /> : tab === "serwer" ? <ServerTab s={s} now={now} /> : tab === "zadania" ? <JobsTab s={s} now={now} /> : <DomainsTab s={s} />}
    </>
  );
}
