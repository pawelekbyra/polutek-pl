import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@admin/components/community/pager";
import { ReportForm } from "@admin/components/channels/channel-forms";
import { Badge, Empty, PageHead } from "@admin/components/ui";
import { fmtDateTime } from "@/lib/modules/admin-overview";
import { CHANNEL_STATUS, REPORT_TARGET, loadChannels, loadReports } from "@admin/lib/channels";
import { REPORT_REASON, withParams } from "@admin/lib/community-format";

export const metadata: Metadata = { title: "Kanały" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ChannelsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = one(sp.tab) === "zgloszenia" ? "zgloszenia" : "kanaly";
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  const reports = tab === "zgloszenia" ? await loadReports({ status: one(sp.stan) === "rozstrzygniete" ? undefined : "PENDING", page }) : null;
  return (
    <>
      <PageHead
        title="Kanały"
        lede="Wszystkie kanały twórców. Zmiana statusu, ostrzeżenia, limity i zgłoszenia treści. Każda decyzja ma powód i trafia do audytu."
      />
      <nav className="tabs" aria-label="Sekcje kanałów">
        <Link href="/kanaly" aria-current={tab === "kanaly" ? "page" : undefined}>Kanały</Link>
        <Link href="/kanaly?tab=zgloszenia" aria-current={tab === "zgloszenia" ? "page" : undefined}>Zgłoszenia</Link>
      </nav>
      {tab === "kanaly" ? <ChannelsTab q={one(sp.q).slice(0, 80)} status={one(sp.status)} page={page} /> : null}
      {reports ? <ReportsTab data={reports} history={one(sp.stan) === "rozstrzygniete"} page={page} /> : null}
    </>
  );
}

async function ChannelsTab({ q, status, page }: { q: string; status: string; page: number }) {
  const list = await loadChannels({ q, status, page });
  const href = (p: number) => withParams("/kanaly", { q: q || undefined, status: status || undefined, page: p > 1 ? p : undefined });
  const now = new Date();
  return (
    <>
      <form className="tile-link-row" method="get" action="/kanaly" role="search">
        <input className="input" type="search" name="q" defaultValue={q} placeholder="Nazwa, @uchwyt albo e-mail właściciela" aria-label="Szukaj kanału" />
        <select className="input" name="status" defaultValue={status} aria-label="Status kanału">
          <option value="">Wszystkie statusy</option>
          {Object.entries(CHANNEL_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">Filtruj</button>
      </form>
      <section className="card card-flush mt-3" aria-label="Lista kanałów">
        {list.items.length === 0 ? (
          <Empty icon="users" title="Brak kanałów dla tych filtrów" />
        ) : (
          list.items.map((c) => (
            <article className="mod-item" key={c.id}>
              <div>
                <strong><Link href={`/kanaly/${c.id}`}>{c.name}</Link></strong>{" "}
                {c.handle ? <span className="muted">@{c.handle}</span> : null}
                <div className="mod-meta">
                  <Badge kind={CHANNEL_STATUS[c.status]?.kind ?? ""}>{CHANNEL_STATUS[c.status]?.label ?? c.status}</Badge>
                  {c.isPrimary ? <Badge kind="info" icon={false}>kanał główny</Badge> : null}
                  <span>{c.videoCount} filmów</span>
                  <span>{c.subscribersCount} subskrybentów</span>
                  {c.ownerEmail ? <span>{c.ownerEmail}</span> : null}
                  {c.openReports ? <Badge kind="warn" icon="flag">{c.openReports} zgłoszeń</Badge> : null}
                  <span>od {fmtDateTime(c.createdAt, now)}</span>
                </div>
              </div>
            </article>
          ))
        )}
        <Pager page={list.page} pageSize={list.pageSize} total={list.total} totalPages={list.totalPages} href={href} noun="kanałów" />
      </section>
    </>
  );
}

type ReportsData = Awaited<ReturnType<typeof loadReports>>;

function ReportsTab({ data, history, page }: { data: ReportsData; history: boolean; page: number }) {
  const href = (p: number) => withParams("/kanaly", { tab: "zgloszenia", stan: history ? "rozstrzygniete" : undefined, page: p > 1 ? p : undefined });
  const now = new Date();
  return (
    <>
      <nav className="tile-link-row" aria-label="Widok zgłoszeń">
        <Link className={`btn btn-sm${!history ? " btn-primary" : ""}`} href="/kanaly?tab=zgloszenia" aria-current={!history ? "page" : undefined}>Do decyzji</Link>
        <Link className={`btn btn-sm${history ? " btn-primary" : ""}`} href="/kanaly?tab=zgloszenia&stan=rozstrzygniete" aria-current={history ? "page" : undefined}>Wszystkie</Link>
      </nav>
      <section className="card card-flush mt-3" aria-label="Zgłoszenia treści">
        {data.items.length === 0 ? (
          <Empty icon="flag" title="Brak zgłoszeń" />
        ) : (
          data.items.map((r) => (
            <article className="mod-item" key={r.id}>
              <div>
                <div className="mod-meta">
                  <Badge kind={r.status === "PENDING" ? "warn" : ""} icon="flag">{REPORT_TARGET[r.targetType] ?? r.targetType}: {REPORT_REASON[r.reason] ?? r.reason}</Badge>
                  {r.channelId ? <Link href={`/kanaly/${r.channelId}`}>{r.channelName ?? "kanał"}</Link> : null}
                  {r.targetLabel ? <span>„{r.targetLabel}”</span> : null}
                  <span>{fmtDateTime(r.createdAt, now)}</span>
                  {r.status !== "PENDING" ? <Badge kind="">{r.status === "ACTION_TAKEN" ? "uznane" : "oddalone"}</Badge> : null}
                </div>
                {r.note ? <blockquote>{r.note}</blockquote> : null}
                {r.status === "PENDING" ? <ReportForm reportId={r.id} canRemoveVideo={r.targetType === "VIDEO"} /> : null}
              </div>
            </article>
          ))
        )}
        <Pager page={data.page || page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} href={href} noun="zgłoszeń" />
      </section>
    </>
  );
}
