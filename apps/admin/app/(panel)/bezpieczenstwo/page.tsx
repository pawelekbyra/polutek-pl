import type { Metadata } from "next";
import Link from "next/link";
import { fmtDateTime, fmtInt, fmtRelative } from "@/lib/modules/admin-overview";
import { AUDIT_PAGE_SIZE, listAuditLog, listSiteAdmins, type AuditFilters } from "@/lib/modules/admin-security";
import { ExportButton } from "@admin/components/revenue/export-button";
import { RevokeOthersButton, RevokeSessionButton } from "@admin/components/security/session-buttons";
import { SectionTabs, pickParam, strParam } from "@admin/components/section-tabs";
import { Icon } from "@admin/components/icons";
import { Badge, Card, Empty, PageHead, State } from "@admin/components/ui";
import { auditActor, auditLabel } from "@admin/lib/audit-labels";
import { listAdminAccounts } from "@admin/lib/auth/accounts";
import { requireAdmin } from "@admin/lib/auth/guard";
import { AUTH_EVENT_PAGE, describeDevice, EVENT_LABEL, listAdminAuthEvents, listAdminSessions, verifyAdminAuthChain } from "@admin/lib/auth/security";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { panelContext } from "@admin/lib/actions/panel";

export const metadata: Metadata = { title: "Bezpieczeństwo" };

type SP = Record<string, string | string[] | undefined>;
const TABS = ["przeglad", "logowania", "audyt"] as const;
const TAB_ITEMS = [["przeglad", "Sesje i konta", "/bezpieczenstwo"], ["logowania", "Logowania do panelu", "/bezpieczenstwo?tab=logowania"], ["audyt", "Dziennik audytu", "/bezpieczenstwo?tab=audyt"]] as const;
const ACTORS = [["", "Każdy aktor"], ["admin", "Administrator"], ["system", "System (crony, webhooki)"], ["user", "Użytkownik"], ["guest", "Gość"]] as const;

export default async function SecurityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = pickParam(sp, "tab", TABS, "przeglad");
  return (
    <>
      <PageHead title="Bezpieczeństwo" lede="Kto się logował, jakie sesje są otwarte i co kto zmienił" actions={<Link className="btn" href="/system/r2"><Icon name="database" />Diagnostyka R2</Link>} />
      <SectionTabs label="Sekcje bezpieczeństwa" items={TAB_ITEMS} current={tab} />
      {isDevFixturesEnabled() ? (
        <Empty icon="info" title="Dane przykładowe">Ten ekran czyta konta, sesje i dziennik z bazy; uruchom panel z bazą, żeby go zobaczyć.</Empty>
      ) : tab === "przeglad" ? (
        <Overview />
      ) : tab === "logowania" ? (
        <SignIns sp={sp} />
      ) : (
        <AuditTab sp={sp} />
      )}
    </>
  );
}

async function Overview() {
  const viewer = await requireAdmin("/bezpieczenstwo");
  const ctx = await panelContext(viewer);
  const [sessions, accounts, siteAdmins] = await Promise.all([listAdminSessions(), listAdminAccounts(), listSiteAdmins(ctx)]);
  const now = new Date();
  const withoutMfa = siteAdmins.filter((a) => !a.twoFactor && a.passkeys === 0);
  return (
    <div className="grid">
      <div className="span-12">
        <div className="banner ok"><Icon name="shield" /><div className="banner-body">{viewer.authMode === "access" ? <><span className="banner-title">Logowanie: Cloudflare Access (kod na Gmail)</span><span className="text-2">Prostszy tryb na czas testów: bez kluczy dostępu i TOTP, więc bezpieczeństwo panelu zależy od skrzynki Gmail właściciela (włącz w Google weryfikację dwuetapową). Dziennik audytu nadal odporny na przepisanie (wyzwalacz w bazie).</span></> : <><span className="banner-title">Panel chroniony trzema warstwami</span><span className="text-2">Cloudflare Access → klucz dostępu + TOTP w panelu → dziennik audytu odporny na przepisanie (wyzwalacz w bazie; rola bazy pp_admin bez prawa kasowania, gdy operator ją nadał).</span></>}</div></div>
      </div>
      <div className="span-7 stack">
        <Card id="h-ses" title={viewer.authMode === "access" ? "Sesja panelu" : "Aktywne sesje panelu"} foot={viewer.authMode === "access" ? <span className="muted">Sesją zarządza Cloudflare Access (12 godzin). Zakończysz ją przyciskiem „Wyloguj” w menu konta albo na admin.pawelperfect.com/cdn-cgi/access/logout.</span> : <><span className="muted">Bezczynność 60 min, najwyżej 12 h. Ponowne potwierdzenie przed zwrotem, rozsyłką, eksportem i zmianą konta.</span><RevokeOthersButton /></>}>
          {viewer.authMode === "access" ? <p className="muted">W tym trybie panel nie przechowuje własnych sesji: każde żądanie niesie podpisany token Cloudflare. Logowania są w zakładce „Logowania do panelu”.</p> : sessions.length === 0 ? <p className="muted">Brak aktywnych sesji (podgląd lokalny?).</p> : (
            <ul className="list">
              {sessions.map((s) => {
                const current = s.id === viewer.sessionId;
                return (
                  <li key={s.id}>
                    <span className="li-icon"><Icon name="monitor" /></span>
                    <div className="li-main">
                      <span className="li-title">{describeDevice(s.userAgent)} {current ? <Badge kind="info" icon={false}>ta sesja</Badge> : null}</span>
                      <span className="li-sub">{s.email} · {s.ip ?? "adres nieznany"} · aktywna {fmtRelative(s.lastSeenAt, now)} · zalogowano {fmtDateTime(s.createdAt, now)}</span>
                    </div>
                    {current ? null : <RevokeSessionButton sessionId={s.id} label={`${describeDevice(s.userAgent)} (${s.email})`} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <div className="span-5 stack">
        <Card id="h-adm" title="Konta w panelu">
          <ul className="list">
            {accounts.map((a) => (
              <li key={a.id}>
                <span className="avatar" aria-hidden="true">{a.name.slice(0, 1).toUpperCase()}</span>
                <div className="li-main">
                  <span className="li-title">{a.name} <span className="muted">· {a.role === "OWNER" ? "właściciel" : "tłumacz"}</span></span>
                  <span className="li-sub">{a.email} · {viewer.authMode === "access" ? "logowanie przez Cloudflare Access" : `${a.passkeys.length} kluczy · TOTP ${a.totp ? "włączony" : "wyłączony"}`} · {a.lastSignInAt ? `ostatnio ${fmtRelative(a.lastSignInAt, now)}` : "bez logowania"}</span>
                </div>
                {viewer.authMode === "access" ? <Badge kind="info" icon={false}>Access</Badge> : a.enrolledAt && a.totp && a.passkeys.length ? <Badge kind="ok">MFA</Badge> : <Badge kind="warn">niedokończone</Badge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card id="h-site" title="Konta ADMIN na stronie (stary panel)" sub="Dopóki działa stary /admin, rola ADMIN na koncie publicznym daje dostęp do niego.">
          {siteAdmins.length === 0 ? <p className="muted">Żadne konto nie ma roli ADMIN.</p> : (
            <>
              <ul className="list">
                {siteAdmins.map((a) => (
                  <li key={a.id}>
                    <div className="li-main"><span className="li-title">{a.email}</span><span className="li-sub">{a.twoFactor ? "TOTP" : "bez TOTP"} · {a.passkeys} kluczy · {a.activeSessions} sesji{a.lastSessionAt ? ` · ostatnia ${fmtRelative(a.lastSessionAt, now)}` : ""}</span></div>
                    {a.twoFactor || a.passkeys ? <Badge kind="ok" icon={false}>2FA</Badge> : <Badge kind="crit">bez 2FA</Badge>}
                  </li>
                ))}
              </ul>
              {withoutMfa.length ? <div className="banner warn mt-3"><Icon name="warn" /><div className="banner-body"><span className="banner-title">{withoutMfa.length} {withoutMfa.length === 1 ? "konto ADMIN" : "kont ADMIN"} bez 2FA</span><span className="text-2">Po wygaszeniu starego panelu (faza 5) ta rola przestaje dawać uprawnienia; do tego czasu włącz im 2FA albo zdejmij rolę.</span></div></div> : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

async function SignIns({ sp }: { sp: SP }) {
  const outcome = pickParam(sp, "wynik", ["", "success", "failure"] as const, "");
  const page = Math.max(1, Number(strParam(sp, "page", 6)) || 1);
  const [data, chain] = await Promise.all([listAdminAuthEvents({ outcome: outcome || undefined, page }), verifyAdminAuthChain(200)]);
  const now = new Date();
  const href = (p: number) => `/bezpieczenstwo?tab=logowania${outcome ? `&wynik=${outcome}` : ""}${p > 1 ? `&page=${p}` : ""}`;
  return (
    <div className="stack">
      <div className="tiles" role="group" aria-label="Logowania">
        <div className="tile"><span className="tile-label">Nieudane (24 h)</span><span className="tile-value">{fmtInt(data.failures24h)}</span><span className="tile-meta">{data.failures24h ? <State kind="warn">sprawdź poniżej</State> : <State kind="ok">brak</State>}</span></div>
        <div className="tile"><span className="tile-label">Łańcuch skrótów</span><span className="tile-value tile-value-sm">{chain.ok ? "zgodny" : "NARUSZONY"}</span><span className="tile-meta">{chain.ok ? <State kind="ok">{`${chain.checked} ostatnich wpisów`}</State> : <State kind="crit">{`pęknięty przy wpisie ${chain.brokenAtSeq}`}</State>}</span></div>
      </div>
      <form className="filters" role="search" aria-label="Filtr logowań" method="get" action="/bezpieczenstwo">
        <input type="hidden" name="tab" value="logowania" />
        <label><span className="sr-only">Wynik</span><select className="select" name="wynik" defaultValue={outcome}><option value="">Wszystkie zdarzenia</option><option value="failure">Tylko nieudane</option><option value="success">Tylko udane</option></select></label>
        <button className="btn" type="submit"><Icon name="filter" />Filtruj</button>
      </form>
      <section className="card card-flush" aria-label="Logowania do panelu">
        <div className="table-scroll">
          <table className="table responsive">
            <caption className="sr-only">Zdarzenia logowania do panelu</caption>
            <thead><tr><th scope="col">Czas</th><th scope="col">Zdarzenie</th><th scope="col">Konto</th><th scope="col" className="hide-sm">Skąd</th><th scope="col" className="hide-md">Żądanie</th></tr></thead>
            <tbody>
              {data.rows.map((e) => (
                <tr key={e.id}>
                  <td data-label="Czas">{fmtDateTime(e.at, now)}</td>
                  <td data-label="Zdarzenie"><strong>{EVENT_LABEL[e.action] ?? e.action}</strong> {e.outcome === "failure" ? <Badge kind="crit">nieudane</Badge> : null}{e.reason ? <div className="muted">{e.reason}</div> : null}</td>
                  <td data-label="Konto">{e.email ?? "—"}</td>
                  <td data-label="Skąd" className="hide-sm">{e.ip ?? "—"}{e.country ? ` (${e.country})` : ""}<div className="muted">{e.device}</div></td>
                  <td data-label="Żądanie" className="hide-md mono">{e.requestId ?? "—"}</td>
                </tr>
              ))}
              {data.rows.length === 0 ? <tr><td colSpan={5} className="muted">brak zdarzeń</td></tr> : null}
            </tbody>
          </table>
        </div>
        {data.totalPages > 1 ? (
          <div className="pager"><span>Strona {data.page} z {data.totalPages} · {fmtInt(data.total)} zdarzeń ({AUTH_EVENT_PAGE} na stronę)</span><nav aria-label="Strony logowań">{data.page > 1 ? <Link className="btn btn-sm" href={href(data.page - 1)} aria-label="Poprzednia strona"><Icon name="left" /></Link> : null}{data.page < data.totalPages ? <Link className="btn btn-sm" href={href(data.page + 1)} aria-label="Następna strona"><Icon name="right" /></Link> : null}</nav></div>
        ) : null}
      </section>
      <p className="foot-note"><Icon name="lock" />Dziennik logowań jest tylko do dopisywania: wyzwalacz w bazie odrzuca UPDATE i kasowanie wpisów młodszych niż 400 dni; skrót każdego wpisu zależy od poprzedniego.</p>
    </div>
  );
}

function auditQuery(sp: SP, patch: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams({ tab: "audyt" });
  for (const k of ["q", "actor", "kind", "from", "to"]) {
    const v = k in patch ? patch[k] : strParam(sp, k);
    if (v) p.set(k, v);
  }
  if (patch.page && patch.page !== "1") p.set("page", patch.page);
  return p.toString();
}

async function AuditTab({ sp }: { sp: SP }) {
  const ctx = await panelContext(await requireAdmin("/bezpieczenstwo?tab=audyt"));
  const date = (k: string) => { const v = strParam(sp, k, 10); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined; };
  const actor = pickParam(sp, "actor", ACTORS.map((a) => a[0]), "");
  const from = date("from");
  const to = date("to");
  const filters: AuditFilters = {
    q: strParam(sp, "q"),
    actorType: (actor || undefined) as AuditFilters["actorType"],
    targetType: strParam(sp, "kind", 60),
    from: from ? new Date(`${from}T00:00:00Z`) : undefined,
    to: to ? new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000) : undefined,
    page: Math.max(1, Number(strParam(sp, "page", 6)) || 1),
  };
  const data = await listAuditLog(ctx, filters);
  const now = new Date();
  const filtered = !!(filters.q || actor || filters.targetType || from || to);
  const exportQuery = auditQuery(sp).replace(/^tab=audyt&?/, "");
  return (
    <div className="stack">
      <form className="filters" role="search" aria-label="Filtry dziennika" method="get" action="/bezpieczenstwo">
        <input type="hidden" name="tab" value="audyt" />
        <label className="search-wrap"><span className="sr-only">Szukaj</span><Icon name="search" /><input className="input" type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Akcja, id obiektu, requestId albo id aktora" data-list-search /></label>
        <label><span className="sr-only">Aktor</span><select className="select" name="actor" defaultValue={actor}>{ACTORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label><span className="sr-only">Obiekt</span><select className="select" name="kind" defaultValue={filters.targetType ?? ""}><option value="">Każdy obiekt</option>{data.targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label><span className="sr-only">Od dnia</span><input className="input" type="date" name="from" defaultValue={from ?? ""} /></label>
        <label><span className="sr-only">Do dnia</span><input className="input" type="date" name="to" defaultValue={to ?? ""} /></label>
        <button className="btn" type="submit"><Icon name="filter" />Filtruj</button>
        {filtered ? <Link className="btn btn-ghost" href="/bezpieczenstwo?tab=audyt">Wyczyść</Link> : null}
        <span className="topbar-spacer" />
        <ExportButton url="/api/export/audit" query={exportQuery} returnTo={`/bezpieczenstwo?${auditQuery(sp)}`} filename="audyt.csv" />
      </form>
      <section className="card card-flush" aria-label="Dziennik audytu">
        <div className="table-scroll">
          <table className="table responsive">
            <caption className="sr-only">Dziennik audytu</caption>
            <thead><tr><th scope="col">Czas</th><th scope="col">Akcja</th><th scope="col">Aktor</th><th scope="col">Obiekt</th><th scope="col" className="hide-sm">IP</th><th scope="col" className="hide-md">Żądanie</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Czas">{fmtDateTime(r.at, now)}</td>
                  <td data-label="Akcja">
                    <strong>{auditLabel(r.action)}</strong>
                    <div className="muted mono">{r.action}</div>
                    {r.metadata ? <details className="more"><summary>Szczegóły</summary><pre className="diff">{JSON.stringify(r.metadata, null, 2)}</pre></details> : null}
                  </td>
                  <td data-label="Aktor">{r.actorLabel ?? auditActor(r.actorType)}{r.systemReason ? <div className="muted">{r.systemReason}</div> : null}</td>
                  <td data-label="Obiekt">{r.targetType ?? "—"}{r.targetId ? <div className="mono muted">{r.targetId.slice(0, 24)}</div> : null}</td>
                  <td data-label="IP" className="hide-sm">{r.ip ?? "—"}</td>
                  <td data-label="Żądanie" className="hide-md mono">{r.requestId ?? "—"}</td>
                </tr>
              ))}
              {data.rows.length === 0 ? <tr><td colSpan={6} className="muted">{filtered ? "nic nie pasuje do filtrów" : "brak wpisów"}</td></tr> : null}
            </tbody>
          </table>
        </div>
        {data.totalPages > 1 ? (
          <div className="pager"><span>Strona {data.page} z {data.totalPages} · {fmtInt(data.total)} wpisów ({AUDIT_PAGE_SIZE} na stronę)</span><nav aria-label="Strony dziennika">{data.page > 1 ? <Link className="btn btn-sm" href={`/bezpieczenstwo?${auditQuery(sp, { page: String(data.page - 1) })}`} aria-label="Poprzednia strona"><Icon name="left" /></Link> : null}{data.page < data.totalPages ? <Link className="btn btn-sm" href={`/bezpieczenstwo?${auditQuery(sp, { page: String(data.page + 1) })}`} aria-label="Następna strona"><Icon name="right" /></Link> : null}</nav></div>
        ) : null}
      </section>
      <p className="foot-note"><Icon name="lock" />Dziennik jest niezmienny: wyzwalacz w bazie odrzuca UPDATE (poza kasowaniem IP po 90 dniach), kasowanie wpisów młodszych niż 400 dni i TRUNCATE. Eksport zawiera adresy IP: wymaga potwierdzenia tożsamości i sam zostaje w dzienniku.</p>
    </div>
  );
}
