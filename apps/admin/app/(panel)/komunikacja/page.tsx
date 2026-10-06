import type { Metadata } from "next";
import Link from "next/link";
import { countBroadcastAudience, getDeliverability, getEmailTemplateDefault, getSuppressions, listAdminBroadcastEmails, listEmailTemplates, getCustomTemplateVariables, getEmailTemplateBySlug } from "@/lib/modules/email";
import { listAdminNotifications, listNotificationTemplates } from "@/lib/modules/notifications";
import { fmtDateTime, fmtInt, fmtOne, fmtRelative } from "@/lib/modules/admin-overview";
import { AutoRefresh, CancelBroadcastButton } from "@admin/components/comms/broadcast-actions";
import { BroadcastWizard } from "@admin/components/comms/broadcast-wizard";
import { TemplateEditor } from "@admin/components/comms/template-editor";
import { SectionTabs, pickParam, strParam } from "@admin/components/section-tabs";
import { Icon } from "@admin/components/icons";
import { Badge, Card, Empty, ExternalLink, Meter, PageHead, State, Tile } from "@admin/components/ui";
import { requireAdmin } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { panelContext } from "@admin/lib/actions/panel";

export const metadata: Metadata = { title: "Komunikacja" };

type SP = Record<string, string | string[] | undefined>;
const TABS = ["przeglad", "rozsylki", "szablony", "wypisy", "powiadomienia"] as const;
const TAB_ITEMS = [["przeglad", "Przegląd", "/komunikacja"], ["rozsylki", "Rozsyłki", "/komunikacja?tab=rozsylki"], ["szablony", "Szablony", "/komunikacja?tab=szablony"], ["wypisy", "Wypisy i blokady", "/komunikacja?tab=wypisy"], ["powiadomienia", "Powiadomienia", "/komunikacja?tab=powiadomienia"]] as const;

const BROADCAST_STATUS: Record<string, [string, "ok" | "warn" | "crit" | "info" | ""]> = {
  DRAFT: ["Szkic", ""], READY: ["W kolejce", "info"], SENDING: ["Wysyłana", "info"], SENT: ["Wysłana", "ok"], PARTIAL_FAILED: ["Część nie doszła", "warn"], FAILED: ["Błąd", "crit"], CANCELLED: ["Anulowana", ""],
};

export default async function CommunicationPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = pickParam(sp, "tab", TABS, "przeglad");
  return (
    <>
      <PageHead
        title="Komunikacja"
        lede="E-maile, rozsyłki, szablony i PP Support"
        actions={<Link className="btn btn-primary" href="/komunikacja?tab=rozsylki&nowa=1"><Icon name="mail" />Nowa rozsyłka</Link>}
      />
      <SectionTabs label="Sekcje komunikacji" items={TAB_ITEMS} current={tab} />
      {isDevFixturesEnabled() ? (
        <Empty icon="info" title="Dane przykładowe">Ten ekran czyta pocztę z bazy; uruchom panel z bazą, żeby go zobaczyć.</Empty>
      ) : tab === "przeglad" ? (
        <Overview />
      ) : tab === "rozsylki" ? (
        <Broadcasts wizard={strParam(sp, "nowa") === "1"} />
      ) : tab === "szablony" ? (
        <Templates slug={strParam(sp, "t")} />
      ) : tab === "wypisy" ? (
        <Suppressions />
      ) : (
        <Notifications />
      )}
    </>
  );
}

const ctxOf = async () => panelContext(await requireAdmin("/komunikacja"));

async function Overview() {
  const ctx = await ctxOf();
  const d = await getDeliverability(ctx);
  const now = new Date();
  const pct = (v: number | null, digits = 1) => (v === null ? "—" : fmtOne(v).replace(/,0$/, "") + (digits ? "" : ""));
  const bounceKind = d.bounceRate === null ? "info" : d.bounceRate >= d.limits.bounceTarget ? "crit" : d.bounceRate >= d.limits.bounceTarget / 2 ? "warn" : "ok";
  const complaintKind = d.complaintRate === null ? "info" : d.complaintRate >= d.limits.complaintTarget ? "crit" : d.complaintRate >= d.limits.complaintTarget / 2 ? "warn" : "ok";
  const dayPct = (d.sentToday / d.limits.perDay) * 100;
  const monthPct = (d.sentMonth / d.limits.perMonth) * 100;
  return (
    <div className="grid">
      <div className="span-12">
        <div className="tiles" role="group" aria-label="Dostarczalność (30 dni)">
          <Tile label="Wysłane (30 dni)" value={fmtInt(d.sent)} hint={d.bounceEventsConnected ? "Zdarzenia email.sent od Resend dla maili tej aplikacji (webhook). Otwarć i kliknięć nie śledzimy." : "Zdarzenia z SES nie są podłączone (brak webhooka SNS), więc liczniki zdarzeń pokazują 0. Rozsyłki i ich błędy widać w kolejce niżej."} />
          <Tile label="Doręczone" value={d.sent ? fmtOne((d.delivered / d.sent) * 100) : "—"} unit={d.sent ? "%" : undefined} delta={<span className="delta-ctx">{fmtInt(d.delivered)} z {fmtInt(d.sent)}</span>} />
          <Tile label="Odbicia" value={pct(d.bounceRate)} unit={d.bounceRate === null ? undefined : "%"} delta={<State kind={bounceKind}>{`cel poniżej ${d.limits.bounceTarget}%`}</State>} />
          <Tile label="Skargi na spam" value={d.complaintRate === null ? "—" : d.complaintRate.toFixed(2).replace(".", ",")} unit={d.complaintRate === null ? undefined : "%"} delta={<State kind={complaintKind}>{`cel poniżej ${String(d.limits.complaintTarget).replace(".", ",")}%`}</State>} />
        </div>
      </div>
      <div className="span-5 stack">
        <Card id="h-rl" title={`Limit wysyłki ${d.limits.provider === "ses" ? "Amazon SES" : "Resend"}`}>
          <div className="limit"><div className="limit-head"><span className="limit-name">Dziś (doba UTC)</span><span className="limit-val">{d.sentToday} / {d.limits.perDay}</span></div><Meter percent={dayPct} label="E-maile dziś" valueText={`${d.sentToday} z ${d.limits.perDay}`} warnAt={70} critAt={90} /></div>
          <div className="limit"><div className="limit-head"><span className="limit-name">Ten miesiąc</span><span className="limit-val">{fmtInt(d.sentMonth)} / {fmtInt(d.limits.perMonth)}</span></div><Meter percent={monthPct} label="E-maile w miesiącu" valueText={`${d.sentMonth} z ${d.limits.perMonth}`} warnAt={70} critAt={90} /></div>
          {d.bounceEventsConnected ? (
            <p className="limit-note">Plan Free; zmiana planu: EMAIL_DAILY_LIMIT / EMAIL_MONTHLY_LIMIT w admin.env (działają też stare RESEND_*). Liczone ze zdarzeń webhooka{d.lastEventAt ? `, ostatnie ${fmtRelative(d.lastEventAt, now)}` : ", brak zdarzeń"}.</p>
          ) : (
            <p className="limit-note">Amazon SES: limity z EMAIL_DAILY_LIMIT / EMAIL_MONTHLY_LIMIT (sandbox: ok. 200 dziennie, 1 na sekundę; po zgodzie produkcyjnej ustaw limit z konsoli SES). Zdarzenia odbić i skarg: nie podłączone; liczniki dnia i miesiąca nie są tu wiarygodne.</p>
          )}
        </Card>
        <Card id="h-pps" title="PP Support" foot={<ExternalLink className="btn btn-sm" href="https://support.pawelperfect.com" hint="skrzynka za Cloudflare Access, nowa karta">Otwórz skrzynkę</ExternalLink>}>
          <p className="text-2">Poczta przychodząca (support@, hello@) trafia do PP Support. Liczby wątków pojawią się na tym ekranie z kolektorem (API wymaga tokenu agenta, którego panel nie przechowuje).</p>
        </Card>
      </div>
      <div className="span-7 stack">
        <Card id="h-bc" title="Kolejka rozsyłek (30 dni)" meta={<Link href="/komunikacja?tab=rozsylki">Rozsyłki <Icon name="right" /></Link>}>
          <dl className="kv kv-wide">
            <dt>Wysłane</dt><dd>{fmtInt(d.broadcastRecipients.sent)}</dd>
            <dt>Czeka</dt><dd>{fmtInt(d.broadcastRecipients.pending)}</dd>
            <dt>Błędy i odbicia</dt><dd>{d.broadcastRecipients.failed ? <State kind="warn">{fmtInt(d.broadcastRecipients.failed)}</State> : "0"}</dd>
          </dl>
        </Card>
        <Card id="h-dns" title="Dostarczalność i DNS poczty">
          <p className="text-2">SPF, DKIM i DMARC nie są sprawdzane przez panel (nie odpytuje DNS przy wyświetlaniu). Stan rekordów i zasady rozgrzewania domeny: docs/operations/EMAIL_DELIVERABILITY.md; weryfikacja domeny w panelu dostawcy (Resend albo Amazon SES, patrz docs/operations/EMAIL_SES.md).</p>
        </Card>
      </div>
    </div>
  );
}

async function Broadcasts({ wizard }: { wizard: boolean }) {
  const viewer = await requireAdmin("/komunikacja?tab=rozsylki");
  const ctx = await panelContext(viewer);
  const [list, audience] = await Promise.all([listAdminBroadcastEmails(ctx), countBroadcastAudience(ctx)]);
  const rows = list.ok ? list.data : [];
  const now = new Date();
  const active = rows.some((b) => b.status === "READY" || b.status === "SENDING");
  return (
    <div className="stack">
      <AutoRefresh active={active} />
      {wizard ? <BroadcastWizard audience={audience.ok ? audience.data.recipientCount : 0} email={viewer.email} /> : null}
      <Card id="h-hist" title="Historia rozsyłek" flush>
        {rows.length === 0 ? <Empty icon="mail" title="Nie było rozsyłek"><Link href="/komunikacja?tab=rozsylki&nowa=1">Utwórz pierwszą</Link></Empty> : (
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Rozsyłki</caption>
              <thead><tr><th scope="col">Rozsyłka</th><th scope="col">Status</th><th scope="col">Utworzona</th><th scope="col" className="num">Odbiorcy</th><th scope="col">Postęp</th><th scope="col"><span className="sr-only">Akcje</span></th></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const [label, kind] = BROADCAST_STATUS[b.status] ?? [b.status, ""];
                  const done = b.counts.sent + b.counts.failed + b.counts.skipped;
                  const percent = b.recipientCount ? Math.round((done / b.recipientCount) * 100) : 0;
                  return (
                    <tr key={b.id}>
                      <td data-label="Rozsyłka" className="wrap">{b.subjectPl}</td>
                      <td data-label="Status"><Badge kind={kind}>{label}</Badge></td>
                      <td data-label="Utworzona">{fmtDateTime(b.createdAt, now)}</td>
                      <td data-label="Odbiorcy" className="num">{fmtInt(b.recipientCount)}</td>
                      <td data-label="Postęp"><div className="progress-cell"><Meter percent={percent} label={`Postęp: ${b.subjectPl}`} valueText={`wysłano ${b.counts.sent}, błędy ${b.counts.failed}, pominięto ${b.counts.skipped}, czeka ${b.counts.pending}`} warnAt={101} critAt={102} /><span className="muted">{b.counts.sent} wysłano · {b.counts.pending} czeka{b.counts.failed ? ` · ${b.counts.failed} błędów` : ""}{b.counts.skipped ? ` · ${b.counts.skipped} pominięto` : ""}</span></div></td>
                      <td className="actions">{b.status === "READY" || b.status === "SENDING" ? <CancelBroadcastButton id={b.id} title={b.subjectPl} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="foot-note"><Icon name="info" />Rozsyłka trafia do kolejki, którą opróżnia zadanie na stronie (partie, ponowienia po błędzie, limit dostawcy poczty). Termin wysyłki w przyszłości nie jest obsługiwany: rozsyłka rusza od razu po utworzeniu.</p>
    </div>
  );
}

async function Templates({ slug }: { slug?: string }) {
  const ctx = await ctxOf();
  const list = await listEmailTemplates(ctx);
  const templates = list.ok ? list.data : [];
  const isNew = slug === "nowy";
  const current = isNew ? null : (templates.find((t) => t.slug === slug) ?? templates[0] ?? null);
  const full = current ? await getEmailTemplateBySlug(ctx, current.slug) : null;
  const dto = full?.ok ? full.data : current;
  const defaults = dto ? getEmailTemplateDefault(dto.slug) : null;
  const vars = dto?.variables ?? getCustomTemplateVariables();
  return (
    <div className="grid">
      <div className="span-4">
        <Card id="h-tl" title="Szablony" flush foot={<Link className="btn btn-sm" href="/komunikacja?tab=szablony&t=nowy">Nowy szablon rozsyłki</Link>}>
          <ul className="list list-pad">
            {templates.map((t) => (
              <li key={t.slug} className={t.slug === current?.slug && !isNew ? "is-active" : undefined}>
                <div className="li-main">
                  <Link className="li-title" href={`/komunikacja?tab=szablony&t=${t.slug}`} aria-current={t.slug === current?.slug && !isNew ? "true" : undefined}>{t.name ?? t.slug}</Link>
                  <span className="li-sub mono">{t.slug}</span>
                </div>
                {t.isSystem ? (t.isCustomized ? <Badge kind="info" icon={false}>zmieniony</Badge> : <Badge kind="outline" icon={false}>domyślny</Badge>) : <Badge kind="outline" icon={false}>własny</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="span-8">
        {isNew || dto ? (
          <Card id="h-te" title={isNew ? "Nowy szablon rozsyłki" : (dto?.name ?? dto?.slug ?? "")} meta={dto ? <span className="mono muted">{dto.slug}</span> : undefined} sub={dto?.description ?? "Punkt wyjścia do rozsyłek. Systemowych maili (powitanie, reset hasła…) nie da się dodać, tylko zmienić."}>
            <TemplateEditor
              key={isNew ? "new" : dto!.slug}
              slug={isNew ? "" : dto!.slug}
              isNew={isNew}
              isSystem={!!dto?.isSystem}
              isCustomized={!!dto?.isCustomized}
              name={dto?.name ?? ""}
              description={dto?.description ?? ""}
              subject={dto?.subject ?? ""}
              html={dto?.html ?? ""}
              subjectEn={dto?.subjectEn ?? ""}
              htmlEn={dto?.htmlEn ?? ""}
              defaults={defaults ? { subject: defaults.subject, html: defaults.html, subjectEn: defaults.subjectEn ?? "", htmlEn: defaults.htmlEn ?? "" } : null}
              variables={vars.map((v) => ({ key: v.key, label: v.label }))}
            />
          </Card>
        ) : (
          <Empty icon="mail" title="Brak szablonów" />
        )}
      </div>
    </div>
  );
}

async function Suppressions() {
  const s = await getSuppressions(await ctxOf());
  const now = new Date();
  return (
    <div className="grid">
      <div className="span-12">
        <div className="tiles" role="group" aria-label="Zgody i blokady">
          <Tile label="Mają zgodę" value={fmtInt(s.counts.consenting)} hint="Osoby z włączonymi powiadomieniami o nowych treściach (EmailPreference)." />
          <Tile label="Wypisane" value={fmtInt(s.counts.unsubscribed)} />
          <Tile label="Zablokowane (odbicie, skarga)" value={fmtInt(s.counts.blocked)} />
        </div>
      </div>
      <div className="span-6">
        <Card id="h-blk" title="Zablokowane adresy" sub="Po twardym odbiciu albo skardze na spam: nie dostają żadnej poczty od nas." flush>
          {s.blocked.length === 0 ? <Empty icon="ok" title="Brak blokad" /> : (
            <table className="table table-compact"><caption className="sr-only">Zablokowane adresy</caption><thead><tr><th scope="col">Adres</th><th scope="col">Powód</th><th scope="col">Ostatnio</th></tr></thead>
              <tbody>{s.blocked.map((b) => <tr key={b.email}><td>{b.email}</td><td>{b.reason === "COMPLAINT" ? "skarga" : "odbicie"}</td><td>{fmtDateTime(b.lastSeenAt, now)}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
      <div className="span-6">
        <Card id="h-uns" title="Wypisani" sub="Wycofali zgodę na powiadomienia; rozsyłki ich pomijają." flush>
          {s.unsubscribed.length === 0 ? <Empty icon="ok" title="Nikt się nie wypisał" /> : (
            <table className="table table-compact"><caption className="sr-only">Wypisani</caption><thead><tr><th scope="col">Adres</th><th scope="col">Kiedy</th></tr></thead>
              <tbody>{s.unsubscribed.map((u) => <tr key={u.email}><td>{u.email}</td><td>{fmtDateTime(u.at, now)}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
      <p className="foot-note span-12"><Icon name="info" />Ręczne zdejmowanie blokad i dopisywanie zgód jest celowo poza panelem: zgoda ma pochodzić od osoby, a blokada chroni reputację domeny.</p>
    </div>
  );
}

async function Notifications() {
  const [templates, items] = await Promise.all([listNotificationTemplates(), listAdminNotifications(30)]);
  const now = new Date();
  return (
    <div className="stack">
      <div className="banner warn" role="status">
        <Icon name="warn" />
        <div className="banner-body">
          <span className="banner-title">Wysyłka wyłączona: dzwonek powiadomień usunięty ze strony (decyzja 2026-10-04)</span>
          <span className="text-2">Ekran jest tylko do odczytu: szablony i ostatnie powiadomienia nie giną. Powrót dzwonka wymaga decyzji właściciela i osobnej zmiany w kodzie; edycja i rozsyłka są tu świadomie nieobecne.</span>
        </div>
      </div>
      <div className="grid">
        <div className="span-6">
          <Card id="h-nt" title="Szablony powiadomień" flush>
            <div className="table-scroll">
              <table className="table responsive"><caption className="sr-only">Szablony powiadomień</caption><thead><tr><th scope="col">Rodzaj</th><th scope="col">Tytuł (PL)</th><th scope="col">Stan</th></tr></thead>
                <tbody>{templates.map((t) => <tr key={t.kind}><td data-label="Rodzaj"><span className="mono">{t.kind}</span></td><td data-label="Tytuł">{t.titlePl}</td><td data-label="Stan">{t.isCustomized ? <Badge kind="info" icon={false}>zmieniony</Badge> : <Badge kind="outline" icon={false}>domyślny</Badge>}</td></tr>)}</tbody></table>
            </div>
          </Card>
        </div>
        <div className="span-6">
          <Card id="h-ns" title="Ostatnie powiadomienia" flush>
            {items.length === 0 ? <Empty icon="inbox" title="Brak powiadomień" /> : (
              <div className="table-scroll"><table className="table table-compact"><caption className="sr-only">Ostatnie powiadomienia</caption><thead><tr><th scope="col">Powiadomienie</th><th scope="col">Dla</th><th scope="col">Kiedy</th><th scope="col">Stan</th></tr></thead>
                <tbody>{items.map((n) => <tr key={n.id}><td>{n.titlePl}<div className="muted mono">{n.kind}</div></td><td>{n.userEmail ?? "usunięte konto"}</td><td>{fmtDateTime(n.createdAt, now)}</td><td>{n.read ? "przeczytane" : "nowe"}</td></tr>)}</tbody></table></div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
