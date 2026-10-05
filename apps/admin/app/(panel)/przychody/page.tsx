import type { Metadata } from "next";
import Link from "next/link";
import { listAdminPayments } from "@/lib/modules/payments";
import { fmtDateTime, fmtInt, fmtMoney, fmtPln, fmtRelative, rangeWindows, type RangeKey } from "@/lib/modules/admin-overview";
import { getReconciliation, getRevenueOverview, getStripeEvents, getTipFunnel, listDisputes, listRecentRefunds, stripeDashboardUrl, type RevenueSummary } from "@/lib/modules/admin-revenue";
import { stripeKeyFacts } from "@/lib/modules/admin-overview";
import { ColumnChart } from "@admin/components/column-chart";
import { ExportButton } from "@admin/components/revenue/export-button";
import { RefundButton } from "@admin/components/revenue/refund-button";
import { SyncDisputeButton } from "@admin/components/revenue/sync-dispute-button";
import { SectionTabs, pickParam, strParam } from "@admin/components/section-tabs";
import { Icon } from "@admin/components/icons";
import { Badge, Card, Check, Empty, ExternalLink, PageHead, State, Tile } from "@admin/components/ui";
import { requireAdmin } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { panelContext } from "@admin/lib/actions/panel";

export const metadata: Metadata = { title: "Przychody" };

type SP = Record<string, string | string[] | undefined>;
const TABS = ["przeglad", "wplaty", "spory", "stripe"] as const;
const RANGES = ["7d", "28d", "90d"] as const;
const STATUS_OPTIONS = [["", "Wszystkie statusy"], ["SUCCEEDED", "Opłacone"], ["PENDING", "Oczekujące"], ["FAILED", "Nieudane"], ["CANCELED", "Anulowane"], ["REFUNDED", "Zwrócone"], ["PARTIALLY_REFUNDED", "Częściowo zwrócone"], ["DISPUTED", "Spór"], ["CHARGEBACK_LOST", "Przegrany spór"]] as const;
const CURRENCY_OPTIONS = ["", "PLN", "EUR", "USD", "CHF", "GBP"] as const;
const STATUS_LABEL: Record<string, [string, "ok" | "warn" | "crit" | "info" | ""]> = {
  SUCCEEDED: ["Opłacone", "ok"], PENDING: ["Oczekuje", "info"], FAILED: ["Nieudane", "crit"], CANCELED: ["Anulowane", ""], REFUNDED: ["Zwrócone", "warn"], PARTIALLY_REFUNDED: ["Częściowo zwrócone", "warn"], DISPUTED: ["Spór", "crit"], CHARGEBACK_LOST: ["Przegrany spór", "crit"],
};

export default async function RevenuePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = pickParam(sp, "tab", TABS, "przeglad");
  const range = pickParam(sp, "range", RANGES, "28d");
  const items = TABS.map((id) => [id, { przeglad: "Przegląd", wplaty: "Wpłaty", spory: "Zwroty i spory", stripe: "Stripe i webhooki" }[id], id === "przeglad" ? `/przychody?range=${range}` : `/przychody?tab=${id}`] as const);
  return (
    <>
      <PageHead title="Przychody" lede="Dobrowolne napiwki · netto po zwrotach, bez opłat Stripe" />
      <SectionTabs label="Sekcje przychodów" items={items} current={tab} />
      {isDevFixturesEnabled() ? (
        <Empty icon="info" title="Dane przykładowe">Ten ekran czyta płatności z bazy; uruchom panel z bazą, żeby go zobaczyć.</Empty>
      ) : tab === "przeglad" ? (
        <Overview range={range} />
      ) : tab === "wplaty" ? (
        <Payments sp={sp} />
      ) : tab === "spory" ? (
        <Disputes />
      ) : (
        <StripeTab />
      )}
    </>
  );
}

const ctxOf = async () => panelContext(await requireAdmin("/przychody"));
const liveMode = () => {
  const f = stripeKeyFacts(process.env.STRIPE_SECRET_KEY);
  return f.mode === "unknown" ? null : f.mode === "live";
};

function moneyList(s: RevenueSummary) {
  return s.byCurrency.length ? s.byCurrency.map((c) => fmtMoney(c.netMinor, c.currency)).join(" · ") : "brak wpłat";
}

async function Overview({ range }: { range: Exclude<RangeKey, "today"> }) {
  const ctx = await ctxOf();
  const w = rangeWindows(range, new Date());
  const [rev, funnel, refunds] = await Promise.all([getRevenueOverview(ctx, w.current), getTipFunnel(ctx, w.current), listRecentRefunds(ctx, 5)]);
  const s = rev.current;
  const days = new Map(rev.series.map((p) => [p.day, p.netPln]));
  const labels: string[] = [];
  const values: number[] = [];
  for (let t = w.current.from.getTime(); t < w.current.to.getTime(); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    labels.push(day.slice(5).replace("-", "."));
    values.push(Math.round(days.get(day) ?? 0));
  }
  const attempts = funnel.find((f) => f.id === "attempts")?.count ?? 0;
  return (
    <div className="grid">
      <div className="span-12">
        <nav className="chip-row" aria-label="Okres">
          {RANGES.map((r) => (
            <Link key={r} className={`btn btn-sm${r === range ? " btn-primary" : ""}`} href={`/przychody?range=${r}`} aria-current={r === range ? "true" : undefined}>
              {{ "7d": "7 dni", "28d": "28 dni", "90d": "90 dni" }[r]}
            </Link>
          ))}
        </nav>
      </div>
      <div className="span-12">
        <div className="tiles" role="group" aria-label="Przychody">
          <Tile label="Przychód netto" value={fmtInt(s.netPln)} unit="zł" hint="Opłacone i częściowo zwrócone napiwki po odjęciu zwrotów; w zł po kursie orientacyjnym. Bez opłat Stripe (ich nie przechowujemy)." />
          <Tile label="Liczba napiwków" value={fmtInt(s.count)} hint="Wpłaty ze statusem SUCCEEDED albo PARTIALLY_REFUNDED." />
          <Tile label="Mediana napiwku" value={s.medianPln === null ? "—" : fmtInt(s.medianPln)} unit="zł" />
          <Tile label="Zwroty" value={fmtInt(s.refundCount)} unit={s.refundCount ? `· ${fmtPln(s.refundedPln)}` : undefined} href="/przychody?tab=spory" />
          <Tile label="Spory" value={fmtInt(s.disputed + s.chargebackLost)} unit={s.chargebackLost ? `· ${s.chargebackLost} przegranych` : undefined} href="/przychody?tab=spory" />
        </div>
      </div>
      <div className="span-8 stack">
        <Card id="h-rev" title="Napiwki w czasie" meta={<Link href="/przychody?tab=wplaty">Lista wpłat <Icon name="right" /></Link>}>
          <ColumnChart title="Napiwki netto (zł) dziennie" summary={`Razem ${fmtPln(s.netPln)} netto w okresie: ${moneyList(s)}.`} labels={labels} values={values} seriesName="Napiwki netto" xName="Dzień" format="pln" height={200} />
          {rev.truncated ? <p className="foot-note"><Icon name="warn" />Okres ma ponad 50 tys. wpłat; wykres liczy pierwsze 50 tys.</p> : null}
          {s.unconvertedCurrencies.length ? <p className="foot-note"><Icon name="info" />Bez przelicznika, więc poza sumą w zł: {s.unconvertedCurrencies.join(", ")}.</p> : null}
        </Card>
      </div>
      <div className="span-4 stack">
        <Card id="h-cur" title="Waluty (netto)" flush>
          <table className="table table-compact">
            <caption className="sr-only">Przychód netto według waluty</caption>
            <thead><tr><th scope="col">Waluta</th><th scope="col" className="num">Napiwków</th><th scope="col" className="num">Netto</th></tr></thead>
            <tbody>
              {s.byCurrency.map((c) => (
                <tr key={c.currency}><th scope="row">{c.currency}</th><td className="num">{fmtInt(c.count)}</td><td className="num">{fmtMoney(c.netMinor, c.currency)}</td></tr>
              ))}
              {s.byCurrency.length === 0 ? <tr><td colSpan={3} className="muted">brak wpłat w okresie</td></tr> : null}
            </tbody>
          </table>
        </Card>
        <Card id="h-def" title="Definicja przychodu">
          <p className="text-2">Napiwek liczy się, gdy ma status SUCCEEDED albo PARTIALLY_REFUNDED, w kwocie pomniejszonej o zwroty. Oczekujące, nieudane, anulowane, zwrócone w całości i w sporze nie są przychodem. Ta sama definicja stoi za „Dzisiaj”.</p>
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-funnel" title="Bramka napiwkowa: gdzie rezygnują" sub="Z bazy: tyle wpłat zaczęto i tak się skończyły. Odsłony bramki są w Analityce.">
          <table className="table table-compact">
            <caption className="sr-only">Lejek bramki napiwkowej</caption>
            <thead><tr><th scope="col">Krok</th><th scope="col" className="num">Liczba</th><th scope="col" className="num">Udział</th></tr></thead>
            <tbody>
              {funnel.map((f) => (
                <tr key={f.id}><th scope="row">{f.label}</th><td className="num">{fmtInt(f.count)}</td><td className="num">{attempts ? `${Math.round((f.count / attempts) * 100)}%` : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-ref" title="Ostatnie zwroty" foot={<Link href="/przychody?tab=spory">Wszystkie zwroty i spory</Link>}>
          {refunds.length === 0 ? <p className="muted">Nie było zwrotów.</p> : (
            <ul className="list">
              {refunds.map((r) => (
                <li key={r.paymentId}>
                  <div className="li-main">
                    <span className="li-title">{fmtMoney(r.refundedMinor, r.currency)} · {r.email ?? "usunięte konto"}</span>
                    <span className="li-sub">{r.at ? fmtDateTime(r.at, new Date()) : "—"}{r.reason ? ` · ${r.reason}` : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function qs(sp: SP, patch: Record<string, string | undefined>, keys = ["q", "status", "currency", "from", "to"]) {
  const p = new URLSearchParams({ tab: "wplaty" });
  for (const k of keys) {
    const v = k in patch ? patch[k] : strParam(sp, k);
    if (v) p.set(k, v);
  }
  if (patch.page && patch.page !== "1") p.set("page", patch.page);
  return p.toString();
}

async function Payments({ sp }: { sp: SP }) {
  const ctx = await ctxOf();
  const q = strParam(sp, "q");
  const status = pickParam(sp, "status", STATUS_OPTIONS.map((o) => o[0]), "");
  const currency = pickParam(sp, "currency", CURRENCY_OPTIONS, "");
  const date = (k: string) => { const v = strParam(sp, k, 10); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined; };
  const from = date("from");
  const to = date("to");
  const page = Math.max(1, Number(strParam(sp, "page", 6)) || 1);
  const res = await listAdminPayments({ search: q, status: (status || undefined) as never, currency: currency || undefined, dateFrom: from ? new Date(`${from}T00:00:00Z`) : undefined, dateTo: to ? new Date(`${to}T23:59:59.999Z`) : undefined, page, pageSize: 20 }, ctx);
  if (!res.ok) return <Empty icon="warn" title="Nie udało się wczytać wpłat">Szczegóły w logu kontenera panelu.</Empty>;
  const d = res.data;
  const live = liveMode();
  const now = new Date();
  const filtered = !!(q || status || currency || from || to);
  return (
    <>
      <form className="filters" role="search" aria-label="Filtry wpłat" method="get" action="/przychody">
        <input type="hidden" name="tab" value="wplaty" />
        <label className="search-wrap"><span className="sr-only">Szukaj</span><Icon name="search" /><input className="input" type="search" name="q" defaultValue={q ?? ""} placeholder="E-mail, id wpłaty albo pi_…" data-list-search /></label>
        <label><span className="sr-only">Status</span><select className="select" name="status" defaultValue={status}>{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label><span className="sr-only">Waluta</span><select className="select" name="currency" defaultValue={currency}>{CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c || "Każda waluta"}</option>)}</select></label>
        <label><span className="sr-only">Od dnia</span><input className="input" type="date" name="from" defaultValue={from ?? ""} /></label>
        <label><span className="sr-only">Do dnia</span><input className="input" type="date" name="to" defaultValue={to ?? ""} /></label>
        <button className="btn" type="submit"><Icon name="filter" />Filtruj</button>
        {filtered ? <Link className="btn btn-ghost" href="/przychody?tab=wplaty">Wyczyść</Link> : null}
        <span className="topbar-spacer" />
        <ExportButton query={qs(sp, {})} returnTo={`/przychody?${qs(sp, {})}`} />
      </form>
      <section className="card card-flush" aria-label="Wpłaty">
        {d.items.length === 0 ? <Empty icon="coins" title={filtered ? "Nic nie pasuje do filtrów" : "Nie ma jeszcze wpłat"} /> : (
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Wpłaty</caption>
              <thead><tr><th scope="col">Data</th><th scope="col">Osoba</th><th scope="col" className="num">Kwota</th><th scope="col">Status</th><th scope="col" className="hide-sm">Stripe</th><th scope="col"><span className="sr-only">Akcje</span></th></tr></thead>
              <tbody>
                {d.items.map((p) => {
                  const [label, kind] = STATUS_LABEL[p.status] ?? [p.status, ""];
                  const left = p.amountMinor - p.refundedAmountMinor;
                  const refundable = (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && left > 0 && !!p.stripeIntentId;
                  const link = stripeDashboardUrl(p.stripeIntentId, live);
                  return (
                    <tr key={p.id}>
                      <td data-label="Data">{fmtDateTime(p.createdAt, now)}</td>
                      <td data-label="Osoba">{p.email}<div className="muted mono" title={p.id}>{p.id.slice(0, 8)}…</div></td>
                      <td data-label="Kwota" className="num"><strong>{fmtMoney(p.amountMinor, p.currency)}</strong>{p.refundedAmountMinor ? <div className="muted">zwrot {fmtMoney(p.refundedAmountMinor, p.currency)}</div> : null}</td>
                      <td data-label="Status"><Badge kind={kind} icon={false}>{label}</Badge></td>
                      <td data-label="Stripe" className="hide-sm">{link ? <ExternalLink className="mono" href={link} hint="otwiera Stripe w nowej karcie">Zobacz w Stripe</ExternalLink> : <span className="muted">—</span>}</td>
                      <td className="actions">{refundable ? <RefundButton returnTo={`/przychody?${qs(sp, {})}`} target={{ id: p.id, email: p.email, currency: p.currency, amountLabel: fmtMoney(p.amountMinor, p.currency), leftMinor: left, leftLabel: fmtMoney(left, p.currency) }} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {d.totalPages > 1 ? (
          <div className="pager">
            <span>Strona {d.page} z {d.totalPages} · {fmtInt(d.total)} wpłat</span>
            <nav aria-label="Strony listy wpłat">
              {d.page > 1 ? <Link className="btn btn-sm" href={`/przychody?${qs(sp, { page: String(d.page - 1) })}`} aria-label="Poprzednia strona"><Icon name="left" /></Link> : null}
              {d.page < d.totalPages ? <Link className="btn btn-sm" href={`/przychody?${qs(sp, { page: String(d.page + 1) })}`} aria-label="Następna strona"><Icon name="right" /></Link> : null}
            </nav>
          </div>
        ) : null}
      </section>
      <p className="foot-note"><Icon name="info" />Zwrot wymaga ponownego potwierdzenia tożsamości, powodu i ma klucz idempotencji; wpłata w sporze nie ma zwrotu (odpowiedz w Stripe). Eksport zawiera e-maile: też wymaga potwierdzenia i zostaje w audycie.</p>
    </>
  );
}

async function Disputes() {
  const ctx = await ctxOf();
  const [disputes, refunds] = await Promise.all([listDisputes(ctx), listRecentRefunds(ctx, 15)]);
  const live = liveMode();
  const now = new Date();
  return (
    <div className="grid">
      <div className="span-7">
        <Card id="h-disp" title="Spory" sub="Najpierw otwarte, z najbliższym terminem na dowody. Termin zapisuje „Odśwież ze Stripe”; webhooki niosą tylko status." flush>
          {disputes.length === 0 ? <Empty icon="ok" title="Brak sporów" /> : (
            <div className="table-scroll">
              <table className="table responsive">
                <caption className="sr-only">Spory</caption>
                <thead><tr><th scope="col">Wpłata</th><th scope="col">Stan</th><th scope="col">Termin na dowody</th><th scope="col"><span className="sr-only">Akcje</span></th></tr></thead>
                <tbody>
                  {disputes.map((d) => {
                    const days = d.dueBy ? Math.ceil((new Date(d.dueBy).getTime() - now.getTime()) / 86_400_000) : null;
                    const link = stripeDashboardUrl(d.stripeIntentId, live);
                    return (
                      <tr key={d.paymentId}>
                        <td data-label="Wpłata"><strong>{fmtMoney(d.amountMinor, d.currency)}</strong><div className="muted">{d.email ?? "usunięte konto"} · {fmtDateTime(d.createdAt, now)}</div>{d.reason ? <div className="muted">powód banku: {d.reason}</div> : null}</td>
                        <td data-label="Stan">{d.status === "DISPUTED" ? <State kind="crit">Wymaga odpowiedzi</State> : <State kind="warn">Przegrany</State>}</td>
                        <td data-label="Termin">{d.dueBy ? <><strong>{fmtDateTime(d.dueBy, now)}</strong><div className={days !== null && days <= 2 ? "muted" : "muted"}>{days !== null && days >= 0 ? `zostało ${days} dni` : "termin minął"}</div></> : <span className="muted">nieznany: odśwież ze Stripe</span>}</td>
                        <td className="actions"><div className="row"><SyncDisputeButton paymentId={d.paymentId} />{link ? <ExternalLink className="btn btn-sm" href={link} hint="Stripe, nowa karta">Otwórz w Stripe</ExternalLink> : null}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <div className="span-5">
        <Card id="h-ref2" title="Ostatnie zwroty">
          {refunds.length === 0 ? <p className="muted">Nie było zwrotów.</p> : (
            <ul className="list">
              {refunds.map((r) => (
                <li key={r.paymentId}><div className="li-main"><span className="li-title">{fmtMoney(r.refundedMinor, r.currency)} · {r.email ?? "usunięte konto"}</span><span className="li-sub">{r.at ? fmtRelative(r.at, now) : "—"}{r.reason ? ` · ${r.reason}` : ""}</span></div></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

async function StripeTab() {
  const ctx = await ctxOf();
  const [ev, rec] = await Promise.all([getStripeEvents(ctx), getReconciliation(ctx)]);
  const now = new Date();
  return (
    <div className="grid">
      <div className="span-6 stack">
        <Card id="h-hook" title="Webhooki Stripe">
          <div className="checks">
            <Check kind={ev.lastAt ? "ok" : "info"} title="Ostatnie zdarzenie" sub={ev.lastAt ? `${fmtRelative(ev.lastAt, now)} (${fmtDateTime(ev.lastAt, now)})` : "brak zdarzeń"} />
            <Check kind={ev.failed ? "crit" : "ok"} title={`${ev.failed} nieudanych (7 dni)`} sub="Stripe ponawia je sam; błąd zostaje w kolumnie „Błąd”." />
            <Check kind={ev.stuck ? "warn" : "ok"} title={`${ev.stuck} zawieszonych w przetwarzaniu (> 15 min)`} />
          </div>
        </Card>
        <Card id="h-rec" title="Rekonsylacja (bez pytania Stripe)">
          <div className="checks">
            <Check kind={rec.stalePending.length ? "warn" : "ok"} title={`${rec.stalePending.length} wpłat PENDING starszych niż 15 min`} sub="Zamyka je zadanie stripe-reconciliation po 24 h." />
            {rec.totals.map((t) => (
              <Check key={t.currency} kind={t.diff === 0 ? "ok" : "crit"} title={`${t.currency}: wpłaty netto ${fmtMoney(t.fromPayments, t.currency)} · sumy osób ${fmtMoney(t.fromTotals, t.currency)}`} sub={t.diff === 0 ? "zgodne" : `różnica ${fmtMoney(t.diff, t.currency)}: któraś ścieżka (webhook, zwrot) nie zaktualizowała sumy osoby`} />
            ))}
          </div>
          {rec.stalePending.length ? (
            <ul className="list mt-3">
              {rec.stalePending.slice(0, 8).map((p) => (
                <li key={p.id}><div className="li-main"><span className="li-title">{fmtMoney(p.amountMinor, p.currency)} · <span className="mono">{p.id.slice(0, 8)}…</span></span><span className="li-sub">{fmtDateTime(p.createdAt, now)}{p.hasIntent ? "" : " · bez intencji Stripe"}</span></div></li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-ev" title="Ostatnie zdarzenia Stripe" flush>
          <div className="table-scroll">
            <table className="table table-compact">
              <caption className="sr-only">Zdarzenia Stripe</caption>
              <thead><tr><th scope="col">Czas</th><th scope="col">Typ</th><th scope="col" className="num">Opóźnienie</th><th scope="col">Stan</th></tr></thead>
              <tbody>
                {ev.events.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDateTime(e.createdAt, now)}</td>
                    <td><span className="mono">{e.type}</span>{e.error ? <div className="muted">Błąd: {e.error}</div> : null}</td>
                    <td className="num">{e.lagMs === null ? "—" : `${(e.lagMs / 1000).toFixed(1).replace(".", ",")} s`}</td>
                    <td>{e.status === "PROCESSED" ? <State kind="ok">Przetworzone</State> : e.status === "FAILED" ? <State kind="crit">Błąd</State> : <State kind="info">W toku</State>}</td>
                  </tr>
                ))}
                {ev.events.length === 0 ? <tr><td colSpan={4} className="muted">brak zdarzeń</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
