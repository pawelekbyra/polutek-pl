import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDateTime, fmtDateY, fmtInt, fmtMoney, fmtRelative } from "@/lib/modules/admin-overview";
import { ProfileActions } from "@admin/components/community/profile-actions";
import { Icon } from "@admin/components/icons";
import { Badge, Card, PageHead, State, Tile } from "@admin/components/ui";
import { auditLabel } from "@admin/lib/audit-labels";
import { loadProfile } from "@admin/lib/community";
import { COMMENT_STATUS, GRANT_SOURCE, PAYMENT_STATUS, initials, muteUntilLabel } from "@admin/lib/community-format";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = await loadProfile((await params).id);
  return { title: u ? `${u.name} · Społeczność` : "Nie znaleziono" };
}

const MAIL_STATUS: Record<string, string> = { SENT: "wysłany", DELIVERED: "doręczony", OPENED: "otwarty", CLICKED: "kliknięty", BOUNCED: "odrzucony", COMPLAINED: "zgłoszony jako spam", FAILED: "błąd", SKIPPED: "pominięty", UNSUBSCRIBED: "wypisany", PENDING: "w kolejce" };

export default async function PersonPage({ params }: Props) {
  const u = await loadProfile((await params).id);
  if (!u) notFound();
  const now = new Date();
  return (
    <>
      <PageHead
        title={u.name}
        crumbs={<><Link href="/spolecznosc?tab=uzytkownicy">Użytkownicy</Link><Icon name="right" /><span>{u.name}</span></>}
        lede={u.isDeleted ? "Konto usunięte i zanonimizowane." : u.email}
        actions={<Link className="btn" href={`/spolecznosc?tab=komentarze&autor=${encodeURIComponent(u.id)}`}><Icon name="message" />Komentarze osoby</Link>}
      />
      <div className="grid">
        <div className="span-12">
          <section className="card" aria-label="Podsumowanie">
            <div className="profile-head">
              <span className="avatar avatar-lg" aria-hidden="true">{initials(u.name)}</span>
              <div className="profile-name"><strong>{u.name}</strong><div className="text-2">{u.email || "—"}</div></div>
              <div className="row">
                {u.emailVerified ? <Badge kind="ok">E-mail potwierdzony</Badge> : <Badge kind="warn">E-mail niepotwierdzony</Badge>}
                {u.hasGoogle ? <Badge kind="outline" icon={false}>Google połączone</Badge> : null}
                {u.hasPasskey ? <Badge kind="ok" icon="passkey">Klucz dostępu</Badge> : null}
                {u.hasTotp ? <Badge kind="ok" icon="lock">TOTP</Badge> : null}
                {!u.hasPasskey && !u.hasTotp ? <Badge icon={false}>Bez 2FA</Badge> : null}
                {u.isSupporter ? <Badge kind="info" icon="heart">Znacznik wspierającego</Badge> : null}
                {u.mute ? <Badge kind="warn" icon="mute">Wyciszony do {muteUntilLabel(u.mute.until)}</Badge> : null}
                {u.role === "ADMIN" ? <Badge kind="info" icon="shield">Rola: administrator</Badge> : null}
                {u.onboardingPending ? <Badge kind="warn" icon={false}>Bez pseudonimu</Badge> : null}
              </div>
            </div>
            <div className="mt-3">
              <ProfileActions
                userId={u.id}
                name={u.name}
                email={u.email}
                role={u.role}
                isDeleted={u.isDeleted}
                isSupporter={u.isSupporter}
                muted={!!u.mute}
                sessions={u.sessions.length}
                impact={{ comments: u.counts.comments, payments: u.counts.payments, activeGrants: u.counts.activeGrants, sessions: u.sessions.length }}
              />
            </div>
          </section>
        </div>

        <div className="span-4 stack">
          <div className="tiles tiles-2" role="group" aria-label="Aktywność osoby">
            <Tile label="Napiwki razem" value={fmtMoney(Math.round(u.totalPaidPln * 100), "PLN")} hint="Przeliczone na złote kursem poglądowym; orientacyjnie." />
            <Tile label="Komentarze" value={fmtInt(u.counts.comments)} />
          </div>
          <Card id="h-acc" title="Konto">
            <dl className="kv">
              <dt>ID</dt><dd className="mono">{u.id}</dd>
              <dt>Dołączyła</dt><dd>{fmtDateY(u.createdAt)}</dd>
              <dt>Język</dt><dd>{u.language === "pl" ? "polski" : u.language === "en" ? "angielski" : u.language}</dd>
              <dt>Logowanie</dt><dd>{[u.hasPassword ? "hasło" : null, u.hasGoogle ? "Google" : null, u.hasPasskey ? "klucz dostępu" : null].filter(Boolean).join(", ") || "—"}</dd>
              <dt>Regulamin</dt><dd>{u.termsAcceptedAt ? `zaakceptowany ${fmtDateY(u.termsAcceptedAt)}` : "brak zapisu"}</dd>
              <dt>Subskrypcje</dt><dd>{u.counts.subscriptions ? "zgoda na powiadomienia" : "brak"}</dd>
              <dt>Polubienia filmów</dt><dd>{fmtInt(u.counts.videoLikes)}</dd>
              {u.mute ? (<><dt>Wyciszenie</dt><dd>do {muteUntilLabel(u.mute.until)}{u.mute.reason ? `: ${u.mute.reason}` : ""}</dd></>) : null}
            </dl>
          </Card>
          <Card id="h-ses" title={`Sesje (${u.sessions.length})`} sub="Urządzenie i czas; bez adresu IP i tokenów.">
            {u.sessions.length ? (
              <ul className="list">
                {u.sessions.map((s) => (
                  <li key={s.id}><div className="li-main"><span className="li-title">{s.device}</span><span className="li-sub">aktywna {fmtRelative(s.lastActiveAt, now)} · od {fmtDateY(s.startedAt)}</span></div></li>
                ))}
              </ul>
            ) : <p className="muted">Brak aktywnych sesji.</p>}
          </Card>
        </div>

        <div className="span-8 stack">
          <Card id="h-up" title={`Napiwki (${u.counts.payments})`} flush sub="Zwroty i spory: Przychody (faza 3).">
            {u.payments.length ? (
              <div className="table-scroll">
                <table className="table responsive">
                  <caption className="sr-only">Wpłaty osoby</caption>
                  <thead><tr><th scope="col">Kiedy</th><th scope="col" className="num">Kwota</th><th scope="col">Stan</th><th scope="col" className="num">Zwrócono</th></tr></thead>
                  <tbody>
                    {u.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-first">{fmtDateTime(p.createdAt, now)}</td>
                        <td data-label="Kwota" className="num">{fmtMoney(p.amountMinor, p.currency)}</td>
                        <td data-label="Stan">{PAYMENT_STATUS[p.status] ?? p.status}</td>
                        <td data-label="Zwrócono" className="num">{p.refundedAmountMinor ? fmtMoney(p.refundedAmountMinor, p.currency) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="card-pad muted">Ta osoba nie wysłała jeszcze napiwku.</p>}
          </Card>

          <Card id="h-gr" title="Znacznik wspierającego: historia" sub="Notatka dla administratora. Nie daje dostępu ani odznaki.">
            {u.grants.length ? (
              <ul className="list">
                {u.grants.map((g) => (
                  <li key={g.id}>
                    <div className="li-main">
                      <span className="li-title">{GRANT_SOURCE[g.source] ?? g.source}{g.reason ? `: ${g.reason}` : ""}</span>
                      <span className="li-sub">nadany {fmtDateTime(g.createdAt, now)}{g.revokedAt ? ` · cofnięty ${fmtDateTime(g.revokedAt, now)}${g.revokeReason ? ` (${g.revokeReason})` : ""}` : ""}</span>
                    </div>
                    {g.active ? <State kind="ok">Aktywny</State> : <Badge icon={false}>Cofnięty</Badge>}
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Brak nadań.</p>}
          </Card>

          <Card id="h-uc" title={`Komentarze (${u.counts.comments})`} meta={u.counts.comments ? <Link href={`/spolecznosc?tab=komentarze&autor=${encodeURIComponent(u.id)}`}>Wszystkie <Icon name="right" /></Link> : undefined}>
            {u.comments.length ? (
              <ul className="list">
                {u.comments.map((c) => {
                  const st = COMMENT_STATUS[c.status] ?? { kind: "" as const, label: c.status };
                  return (
                    <li key={c.id}>
                      <div className="li-main"><span className="li-title">{c.text ?? "(treść usunięta przez autora)"}</span><span className="li-sub">„{c.videoTitle}” · {fmtDateTime(c.createdAt, now)} · {c.likesCount} polubień</span></div>
                      <Badge kind={st.kind} icon={false}>{st.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted">Brak komentarzy.</p>}
          </Card>

          <div className="grid">
            <div className="span-6">
              <Card id="h-uw" title="Oglądanie">
                {u.watching.length ? (
                  <ul className="list">{u.watching.map((w) => (<li key={w.videoId}><div className="li-main"><span className="li-title">{w.title}</span><span className="li-sub">{w.progressPercent !== null ? `${w.progressPercent}% filmu` : "bez długości"} · {w.watchedMinutes} min</span></div></li>))}</ul>
                ) : <p className="muted">Brak zapisanych odtworzeń.</p>}
              </Card>
            </div>
            <div className="span-6">
              <Card id="h-ue" title="E-maile">
                {u.emails.length ? (
                  <ul className="list">{u.emails.map((m) => (<li key={m.id}><div className="li-main"><span className="li-title">{m.subject}</span><span className="li-sub">{fmtDateTime(m.at, now)}</span></div><span className="text-2">{MAIL_STATUS[m.status] ?? m.status}</span></li>))}</ul>
                ) : <p className="muted">Brak rozsyłek do tej osoby.</p>}
              </Card>
            </div>
          </div>

          <Card id="h-ua" title="Audyt dotyczący osoby" sub="Zmiany na koncie i działania administratora. Najnowsze na górze.">
            {u.audit.length ? (
              <ul className="list">
                {u.audit.slice(0, 15).map((a) => (
                  <li key={a.id}><div className="li-main"><span className="li-title">{auditLabel(a.action)}</span><span className="li-sub">{fmtDateTime(a.createdAt, now)} · {a.actor}{a.reason ? ` · powód: ${a.reason}` : ""}</span></div></li>
                ))}
              </ul>
            ) : <p className="muted">Brak wpisów.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
