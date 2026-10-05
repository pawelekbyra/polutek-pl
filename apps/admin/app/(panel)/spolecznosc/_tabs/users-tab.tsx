import Link from "next/link";
import { USER_SEGMENTS, USER_SORTS, type UserSegment, type UserSort } from "@/lib/modules/admin-community";
import { fmtDateY, fmtInt, fmtMoney, fmtRelative } from "@/lib/modules/admin-overview";
import { ExportButton } from "@admin/components/community/export-button";
import { Pager } from "@admin/components/community/pager";
import { Icon } from "@admin/components/icons";
import { Badge, Empty, Tile } from "@admin/components/ui";
import { loadUsers } from "@admin/lib/community";
import { SEGMENTS, USER_SORT_LABEL, initials, muteUntilLabel, withParams } from "@admin/lib/community-format";

const asSeg = (v: string): UserSegment | undefined => (USER_SEGMENTS as readonly string[]).includes(v) ? (v as UserSegment) : undefined;
const asSort = (v: string): UserSort | undefined => (USER_SORTS as readonly string[]).includes(v) ? (v as UserSort) : undefined;

/** Header cell that sorts by one key: first click ascending (descending for numbers), then reverses. */
function SortHead({ label, asc, desc, sort, params }: { label: string; asc: UserSort; desc: UserSort; sort: UserSort; params: Record<string, string> }) {
  const next = sort === asc ? desc : asc;
  return (
    <th scope="col" aria-sort={sort === asc ? "ascending" : sort === desc ? "descending" : "none"}>
      <Link href={withParams("/spolecznosc", { ...params, sort: next })}>{label}{sort === asc ? " ↑" : sort === desc ? " ↓" : ""}</Link>
    </th>
  );
}

export async function UsersTab({ q, seg, sort, page, deleted }: { q: string; seg: string; sort: string; page: number; deleted: boolean }) {
  const segment = asSeg(seg);
  const order = asSort(sort) ?? "created-desc";
  const { list, stats } = await loadUsers({ q: q || undefined, seg: segment, sort: order, page });
  const params = { tab: "uzytkownicy", q, seg: segment ?? "" };
  const here = withParams("/spolecznosc", { ...params, sort: order === "created-desc" ? "" : order, page: page > 1 ? page : undefined });
  const now = new Date();
  return (
    <>
      {deleted ? (
        <div className="banner ok mb-3" role="status">
          <Icon name="ok" />
          <div className="banner-body"><span className="banner-title">Konto usunięte i zanonimizowane</span><span className="text-2">Wpis ADMIN_USER_DELETED w audycie.</span></div>
        </div>
      ) : null}
      {stats ? (
        <div className="tiles mb-3" role="group" aria-label="Konta">
          <Tile label="Konta" value={fmtInt(stats.accounts)} href="/spolecznosc?tab=uzytkownicy" />
          <Tile label="Nowe (7 dni)" value={fmtInt(stats.newInWeek)} href="/spolecznosc?tab=uzytkownicy&seg=nowi" />
          <Tile label="Ze znacznikiem wspierającego" value={fmtInt(stats.supporters)} hint="Znacznik widzi tylko administrator; nie daje dostępu ani odznaki." href="/spolecznosc?tab=uzytkownicy&seg=wspierajacy" />
          <Tile label="Niezweryfikowane" value={fmtInt(stats.unverified)} href="/spolecznosc?tab=uzytkownicy&seg=niezweryfikowani" />
        </div>
      ) : null}
      <form className="filters" role="search" aria-label="Filtry użytkowników" method="get" action="/spolecznosc">
        <input type="hidden" name="tab" value="uzytkownicy" />
        <label className="search-wrap">
          <span className="sr-only">Szukaj po pseudonimie lub e-mailu</span>
          <Icon name="search" />
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Pseudonim lub e-mail" />
        </label>
        <label>
          <span className="sr-only">Segment</span>
          <select className="select" name="seg" defaultValue={segment ?? ""}>{SEGMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label>
          <span className="sr-only">Sortowanie</span>
          <select className="select" name="sort" defaultValue={order}>{USER_SORTS.map((s) => <option key={s} value={s}>{USER_SORT_LABEL[s]}</option>)}</select>
        </label>
        <button className="btn" type="submit"><Icon name="filter" />Filtruj</button>
        {q || segment ? <Link className="btn btn-ghost" href="/spolecznosc?tab=uzytkownicy">Wyczyść filtry</Link> : null}
        <ExportButton q={q || undefined} seg={segment} returnPath={here} />
      </form>
      <section className="card card-flush" aria-label="Użytkownicy">
        {list.items.length === 0 ? (
          <Empty icon="users" title="Brak kont dla tych filtrów" />
        ) : (
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Konta na stronie</caption>
              <thead>
                <tr>
                  <SortHead label="Osoba" asc="nick-asc" desc="nick-desc" sort={order} params={params} />
                  <SortHead label="Dołączyła" asc="created-asc" desc="created-desc" sort={order} params={params} />
                  <th scope="col" className="hide-md">Ostatnio</th>
                  <th scope="col" className="num hide-md">Komentarze</th>
                  <SortHead label="Napiwki" asc="wplaty-asc" desc="wplaty-desc" sort={order} params={params} />
                  <th scope="col">Konto</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((u) => (
                  <tr key={u.id}>
                    <td className="cell-first">
                      <div className="cell-title">
                        <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
                        <div><Link href={`/spolecznosc/u/${u.id}`}>{u.name}</Link><div className="muted">{u.email || "—"}</div></div>
                      </div>
                    </td>
                    <td data-label="Dołączyła">{fmtDateY(u.createdAt)}</td>
                    <td data-label="Ostatnio" className="hide-md">{u.lastSeenAt ? fmtRelative(u.lastSeenAt, now) : "—"}</td>
                    <td data-label="Komentarze" className="num hide-md">{u.commentsCount}</td>
                    <td data-label="Napiwki" className="num">{u.paymentsCount ? `${u.paymentsCount} · ${fmtMoney(Math.round(u.tipsPln * 100), "PLN")}` : <span className="muted">—</span>}</td>
                    <td data-label="Konto">
                      <span className="row">
                        {u.isDeleted ? <Badge icon={false}>Usunięte</Badge> : u.mutedUntil ? <Badge kind="warn" icon="mute">Wyciszony do {muteUntilLabel(u.mutedUntil)}</Badge> : u.emailVerified ? <Badge kind="ok">Zweryfikowany</Badge> : <Badge kind="warn">Niezweryfikowany</Badge>}
                        {u.hasSecondFactor ? <Badge kind="outline" icon="lock">2FA</Badge> : null}
                        {u.role === "ADMIN" ? <Badge kind="info" icon="shield">Admin</Badge> : null}
                        {u.isSupporter ? <Badge kind="outline" icon="heart">Wspiera</Badge> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={list.page} pageSize={list.pageSize} total={list.total} totalPages={list.totalPages} href={(p) => withParams("/spolecznosc", { ...params, sort: order === "created-desc" ? "" : order, page: p > 1 ? p : undefined })} noun="kont" />
      </section>
    </>
  );
}
