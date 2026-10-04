import type { Metadata } from "next";
import Link from "next/link";
import { CommentReportStatus, CommentStatus } from "@prisma/client";
import { fmtDateTime, fmtDateY, fmtInt, fmtMoney } from "@/lib/modules/admin-overview";
import { CommentButtons, ReportButtons } from "@admin/components/community/moderation";
import { Icon } from "@admin/components/icons";
import { Badge, Empty, PageHead, Tile } from "@admin/components/ui";
import { loadComments, loadReports, loadUsers } from "@admin/lib/community";

export const metadata: Metadata = { title: "Społeczność" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TABS = [
  ["uzytkownicy", "Użytkownicy"],
  ["komentarze", "Komentarze"],
  ["zgloszenia", "Zgłoszenia"],
] as const;

const COMMENT_STATUS: Record<string, { kind: "ok" | "warn" | "info" | ""; label: string }> = {
  VISIBLE: { kind: "ok", label: "Widoczny" },
  HELD_FOR_REVIEW: { kind: "info", label: "Wstrzymany" },
  HIDDEN: { kind: "warn", label: "Ukryty" },
  DELETED: { kind: "", label: "Usunięty" },
};

const REASON: Record<string, string> = { SPAM: "spam", HARASSMENT: "nękanie", HATE: "nienawiść", NSFW: "treści dla dorosłych", SPOILER: "spoiler", OTHER: "inne" };

function Pager({ page, totalPages, href }: { page: number; totalPages: number; href: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pager">
      <span>
        Strona {page} z {totalPages}
      </span>
      <nav aria-label="Strony listy">
        {page > 1 ? (
          <Link className="btn btn-sm" href={href(page - 1)} aria-label="Poprzednia strona">
            <Icon name="left" />
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link className="btn btn-sm" href={href(page + 1)} aria-label="Następna strona">
            <Icon name="right" />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

export default async function CommunityPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = TABS.find(([id]) => id === one(sp.tab))?.[0] ?? "uzytkownicy";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q)?.slice(0, 120) ?? "";
  const now = new Date();
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab, q, ...Object.fromEntries(["status", "role", "platnicy"].map((k) => [k, one(sp[k])])), ...patch })) if (v !== undefined && v !== "" && !(k === "tab" && v === "uzytkownicy")) p.set(k, String(v));
    return `/spolecznosc${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHead title="Społeczność" lede="Konta, komentarze i zgłoszenia. Zmiana roli i usunięcie konta wymagają potwierdzenia tożsamości." />
      <nav className="tabs" aria-label="Sekcje społeczności">
        {TABS.map(([id, label]) => (
          <Link key={id} href={id === "uzytkownicy" ? "/spolecznosc" : `/spolecznosc?tab=${id}`} aria-current={tab === id ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {typeof sp.usunieto === "string" ? (
        <div className="banner ok mb-3" role="status">
          <Icon name="ok" />
          <div className="banner-body">
            <span className="banner-title">Konto usunięte i zanonimizowane</span>
            <span className="text-2">Wpis ADMIN_USER_DELETED w audycie.</span>
          </div>
        </div>
      ) : null}
      {tab === "uzytkownicy" ? <UsersTab sp={sp} q={q} page={page} qs={qs} /> : tab === "komentarze" ? <CommentsTab sp={sp} q={q} page={page} qs={qs} now={now} /> : <ReportsTab sp={sp} page={page} qs={qs} now={now} />}
    </>
  );
}

type TabProps = { sp: Record<string, string | string[] | undefined>; page: number; qs: (p: Record<string, string | number | undefined>) => string };

async function UsersTab({ sp, q, page, qs }: TabProps & { q: string }) {
  const role = one(sp.role) === "ADMIN" ? "ADMIN" : one(sp.role) === "USER" ? "USER" : undefined;
  const payers = one(sp.platnicy) === "1";
  const list = await loadUsers({ q, role, payers, page });
  return (
    <>
      {list.stats ? (
        <div className="tiles mb-3" role="group" aria-label="Konta">
          <Tile label="Konta" value={fmtInt(list.stats.totalUsers)} />
          <Tile label="Aktywne (nieusunięte)" value={fmtInt(list.stats.activeUsers)} />
          <Tile label="Wspierający" value={fmtInt(list.stats.patrons)} hint="Konta z co najmniej jednym napiwkiem; znacznik widzi tylko administrator." />
          <Tile label="Wpłaty" value={fmtInt(list.stats.totalPayments)} />
        </div>
      ) : null}
      <form className="filters" role="search" aria-label="Filtry kont" method="get" action="/spolecznosc">
        <label className="search-wrap">
          <span className="sr-only">Szukaj po pseudonimie lub e-mailu</span>
          <Icon name="search" />
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Pseudonim lub e-mail" />
        </label>
        <label>
          <span className="sr-only">Rola</span>
          <select className="select" name="role" defaultValue={role ?? ""}>
            <option value="">Każda rola</option>
            <option value="ADMIN">Administratorzy</option>
            <option value="USER">Użytkownicy</option>
          </select>
        </label>
        <label className="choice">
          <input type="checkbox" name="platnicy" value="1" defaultChecked={payers} /> Tylko z wpłatami
        </label>
        <button className="btn" type="submit">
          <Icon name="filter" />
          Filtruj
        </button>
      </form>
      <section className="card card-flush" aria-label="Konta">
        {list.items.length === 0 ? (
          <Empty icon="users" title="Brak kont dla tych filtrów" />
        ) : (
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Konta na stronie</caption>
              <thead>
                <tr>
                  <th scope="col">Osoba</th>
                  <th scope="col">Rola</th>
                  <th scope="col" className="hide-md">Język</th>
                  <th scope="col">Wpłaty</th>
                  <th scope="col">Założone</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((u) => (
                  <tr key={u.id}>
                    <td className="cell-first">
                      <div>
                        <Link href={`/spolecznosc/osoby/${u.id}`}>{u.isDeleted ? "usunięte konto" : u.name || "(bez pseudonimu)"}</Link>
                        <div className="muted">{u.isDeleted ? "—" : u.email}</div>
                      </div>
                    </td>
                    <td data-label="Rola">{u.role === "ADMIN" ? <Badge kind="info" icon={false}>administrator</Badge> : <span className="muted">użytkownik</span>}{u.isPatron ? <> <Badge kind="outline" icon={false}>wspiera</Badge></> : null}</td>
                    <td data-label="Język" className="hide-md">{u.language ?? "—"}</td>
                    <td data-label="Wpłaty">{u.paymentCount ? `${u.paymentCount} · ${u.paymentTotals.map((t) => fmtMoney(t.totalPaidMinor, t.currency)).join(", ")}` : <span className="muted">brak</span>}</td>
                    <td data-label="Założone">{fmtDateY(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={list.page} totalPages={list.totalPages} href={(p) => qs({ page: p })} />
      </section>
    </>
  );
}

async function CommentsTab({ sp, q, page, qs, now }: TabProps & { q: string; now: Date }) {
  const raw = one(sp.status);
  const status = raw && raw in CommentStatus ? (raw as CommentStatus) : undefined;
  const list = await loadComments({ q, status, page });
  return (
    <>
      <form className="filters" role="search" aria-label="Filtry komentarzy" method="get" action="/spolecznosc">
        <input type="hidden" name="tab" value="komentarze" />
        <label className="search-wrap">
          <span className="sr-only">Szukaj w treści</span>
          <Icon name="search" />
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Szukaj w treści" />
        </label>
        <label>
          <span className="sr-only">Stan</span>
          <select className="select" name="status" defaultValue={status ?? ""}>
            <option value="">Każdy stan</option>
            {Object.entries(COMMENT_STATUS).map(([v, s]) => (
              <option key={v} value={v}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">
          <Icon name="filter" />
          Filtruj
        </button>
      </form>
      <section className="card card-flush" aria-label="Komentarze">
        {list.items.length === 0 ? (
          <Empty icon="message" title="Brak komentarzy dla tych filtrów" />
        ) : (
          list.items.map((c) => {
            const st = COMMENT_STATUS[c.status] ?? { kind: "" as const, label: c.status };
            const author = c.author?.displayName ?? "usunięte konto";
            return (
              <article className="mod-item" key={c.id}>
                <div>
                  <blockquote>{c.text ?? <span className="muted">(treść usunięta przez autora)</span>}</blockquote>
                  <div className="mod-meta">
                    <Badge kind={st.kind} icon={false}>{st.label}</Badge>
                    {c.author ? <Link href={`/spolecznosc/osoby/${c.author.id}`}>{author}</Link> : <span>{author}</span>}
                    <Link href={`/tresci/${c.videoId}`}>film</Link>
                    <span>{fmtDateTime(c.createdAt, now)}</span>
                    {c.reportsCount ? <Badge kind="warn" icon="flag">{`${c.reportsCount} zgłosz.`}</Badge> : null}
                    {c.parentId ? <span>odpowiedź</span> : null}
                  </div>
                </div>
                <div className="mod-actions">
                  <CommentButtons commentId={c.id} status={c.status} author={author} />
                </div>
              </article>
            );
          })
        )}
        <Pager page={list.page} totalPages={list.totalPages} href={(p) => qs({ page: p })} />
      </section>
    </>
  );
}

async function ReportsTab({ sp, page, qs, now }: TabProps & { now: Date }) {
  const status = one(sp.status) === "DISMISSED" ? CommentReportStatus.DISMISSED : one(sp.status) === "ACTION_TAKEN" ? CommentReportStatus.ACTION_TAKEN : CommentReportStatus.PENDING;
  const list = await loadReports(status, page);
  return (
    <>
      <nav className="filters" aria-label="Stan zgłoszeń">
        {(
          [
            ["PENDING", "Do decyzji"],
            ["ACTION_TAKEN", "Uznane"],
            ["DISMISSED", "Oddalone"],
          ] as const
        ).map(([v, l]) => (
          <Link key={v} className={`btn btn-sm${status === v ? " btn-primary" : ""}`} href={qs({ status: v === "PENDING" ? undefined : v, page: undefined })} aria-current={status === v ? "page" : undefined}>
            {l}
          </Link>
        ))}
      </nav>
      <section className="card card-flush" aria-label="Zgłoszenia">
        {list.items.length === 0 ? (
          <Empty icon="ok" title={status === "PENDING" ? "Nie ma zgłoszeń do decyzji" : "Brak zgłoszeń"} />
        ) : (
          list.items.map((r) => (
            <article className="mod-item" key={r.id}>
              <div>
                <blockquote>{r.comment.text ?? <span className="muted">(treść niedostępna)</span>}</blockquote>
                <div className="mod-meta">
                  <Badge kind="warn" icon="flag">{REASON[r.reason] ?? r.reason}</Badge>
                  <span>autor: {r.comment.author}</span>
                  <span>zgłosił(a): {r.reporter}</span>
                  {r.comment.videoSlug ? <Link href={`/tresci/${r.comment.videoSlug}`}>„{r.comment.videoTitle}”</Link> : null}
                  <span>{fmtDateTime(r.createdAt, now)}</span>
                  {r.note ? <span>„{r.note}”</span> : null}
                </div>
              </div>
              <div className="mod-actions">{r.status === "PENDING" ? <ReportButtons reportId={r.id} commentId={r.comment.id} /> : <span className="muted">{r.status === "DISMISSED" ? "oddalone" : "uznane"}</span>}</div>
            </article>
          ))
        )}
        <Pager page={list.page} totalPages={list.totalPages} href={(p) => qs({ page: p })} />
      </section>
    </>
  );
}
