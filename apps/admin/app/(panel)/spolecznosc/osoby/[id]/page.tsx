import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDateTime, fmtDateY, fmtInt, fmtMoney } from "@/lib/modules/admin-overview";
import { UserActions } from "@admin/components/community/user-actions";
import { Icon } from "@admin/components/icons";
import { Badge, Card, PageHead, Tile } from "@admin/components/ui";
import { auditLabel } from "@admin/lib/audit-labels";
import { loadUser } from "@admin/lib/community";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = await loadUser((await params).id);
  return { title: u ? `${u.isDeleted ? "Usunięte konto" : u.name ?? "Osoba"} · Społeczność` : "Nie znaleziono" };
}

const PAYMENT_STATUS: Record<string, string> = { SUCCEEDED: "opłacona", PENDING: "w toku", FAILED: "nieudana", CANCELED: "anulowana", REFUNDED: "zwrócona", PARTIALLY_REFUNDED: "częściowo zwrócona", DISPUTED: "spór" };

type Payment = { id: string; amountMinor: number; currency: string; status: string; createdAt: string | Date; refundedAmountMinor?: number | null };
type Audit = { id: string; action: string; createdAt: string | Date };

export default async function PersonPage({ params }: Props) {
  const u = await loadUser((await params).id);
  if (!u) notFound();
  const now = new Date();
  const name = u.isDeleted ? "Usunięte konto" : u.name || "(bez pseudonimu)";
  const payments = (u.payments ?? []) as Payment[];
  const audit = (u.auditLogs ?? []) as Audit[];
  return (
    <>
      <PageHead
        title={name}
        crumbs={
          <>
            <Link href="/spolecznosc">Społeczność</Link>
            <Icon name="right" />
            <span>{name}</span>
          </>
        }
        lede={
          <span className="film-meta">
            {u.role === "ADMIN" ? <Badge kind="info" icon={false}>administrator strony</Badge> : <Badge kind="outline" icon={false}>użytkownik</Badge>}
            {u.isPatron ? <Badge kind="outline" icon={false}>wspiera (widoczne tylko tutaj)</Badge> : null}
            {u.isDeleted ? <Badge kind="warn">konto usunięte</Badge> : null}
            {!u.isDeleted ? <span className="muted">{u.email}{u.emailVerified ? "" : " · e-mail niepotwierdzony"}</span> : null}
          </span>
        }
      />
      <div className="grid">
        <div className="span-8 stack">
          <div className="tiles" role="group" aria-label="Aktywność osoby">
            <Tile label="Komentarze" value={fmtInt(u._count.comments)} />
            <Tile label="Polubienia filmów" value={fmtInt(u._count.videoLikes)} />
            <Tile label="Wpłaty" value={fmtInt(payments.length)} />
            <Tile label="Założone" value={<span className="tile-value-sm">{fmtDateY(u.createdAt)}</span>} />
          </div>
          <Card id="h-pay" title="Wpłaty" flush sub="Zwroty i spory: na razie w starym panelu (Przychody, faza 3).">
            {payments.length ? (
              <div className="table-scroll">
                <table className="table responsive">
                  <caption className="sr-only">Wpłaty osoby</caption>
                  <thead>
                    <tr>
                      <th scope="col">Kiedy</th>
                      <th scope="col" className="num">Kwota</th>
                      <th scope="col">Stan</th>
                      <th scope="col" className="num">Zwrócono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
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
            ) : (
              <p className="card-pad muted">Brak wpłat.</p>
            )}
          </Card>
          <Card id="h-act" title="Rola i konto">
            <UserActions userId={u.id} email={u.email ?? ""} name={name} role={u.role} deleted={u.isDeleted} />
          </Card>
        </div>
        <div className="span-4 stack">
          <Card id="h-info" title="Konto">
            <dl className="kv">
              <dt>Język</dt>
              <dd>{u.language ?? "—"}</dd>
              <dt>E-mail</dt>
              <dd>{u.emailVerified ? "potwierdzony" : "niepotwierdzony"}</dd>
              <dt>Subskrypcje</dt>
              <dd>{(u.subscriptions ?? []).length ? "zgoda na powiadomienia" : "brak"}</dd>
              <dt>Id</dt>
              <dd className="mono">{u.id}</dd>
            </dl>
          </Card>
          <Card id="h-aud" title="Historia (audyt)">
            {audit.length ? (
              <ul className="list">
                {audit.slice(0, 12).map((a) => (
                  <li key={a.id}>
                    <div className="li-main">
                      <span className="li-title">{auditLabel(a.action)}</span>
                      <span className="li-sub">{fmtDateTime(a.createdAt, now)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Brak wpisów.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
