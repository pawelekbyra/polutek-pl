import type { Metadata } from "next";
import Link from "next/link";
import { fmtDateY, fmtInt } from "@/lib/modules/admin-overview";
import type { ContentFilters } from "@/lib/modules/admin-content";
import { Icon } from "@admin/components/icons";
import { Badge, Empty, PageHead, State } from "@admin/components/ui";
import { TIER_LABEL, hlsOf, loadContentList, statusOf, thumbSrc } from "@admin/lib/content";

export const metadata: Metadata = { title: "Treści" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

const STATUS = [["", "Wszystkie statusy"], ["PUBLISHED", "Opublikowane"], ["UNLISTED", "Niepubliczne"], ["DRAFT", "Szkice"], ["ARCHIVED", "Archiwum"]] as const;
const TIERS = [["", "Każdy dostęp"], ["PUBLIC", "Publiczny"], ["LOGGED_IN", "Po zalogowaniu"]] as const;
const HLS = [["", "Każdy stan wideo"], ["READY", "Wideo gotowe"], ["PROCESSING", "W kodowaniu"], ["FAILED", "Błąd kodowania"], ["MISSING_SOURCE", "Bez oryginału"]] as const;
const SORTS = [["created", "Najnowsze"], ["published", "Data publikacji"], ["title", "Tytuł"], ["views", "Obejrzenia"]] as const;

function query(f: ContentFilters, patch: Partial<ContentFilters>) {
  const next = { ...f, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== "" && !(k === "page" && v === 1) && !(k === "sort" && v === "created")) p.set(k, String(v));
  const s = p.toString();
  return s ? `/tresci?${s}` : "/tresci";
}

export default async function ContentListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters: ContentFilters = {
    q: typeof sp.q === "string" ? sp.q.slice(0, 120) : undefined,
    status: pick(sp.status, ["PUBLISHED", "UNLISTED", "DRAFT", "ARCHIVED"] as const),
    tier: pick(sp.tier, ["PUBLIC", "LOGGED_IN"] as const),
    hls: pick(sp.hls, ["READY", "PROCESSING", "FAILED", "MISSING_SOURCE"] as const),
    sort: pick(sp.sort, ["created", "published", "title", "views"] as const),
    page: Math.max(1, Number(sp.page) || 1),
  };
  const now = new Date();
  const list = await loadContentList(filters);
  const encoding = list.items.filter((v) => v.migrationStatus === "PROCESSING");
  const failed = list.items.filter((v) => v.migrationStatus === "FAILED");
  const filtered = !!(filters.q || filters.status || filters.tier || filters.hls);

  return (
    <>
      <PageHead
        title="Treści"
        lede={`${fmtInt(list.total)} ${filtered ? "pasujących filmów" : "filmów"}${failed.length ? ` · ${failed.length} z błędem kodowania` : ""}`}
        actions={
          <>
            <Link className="btn" href="/tresci/uklad">
              <Icon name="settings" />
              Układ kanału
            </Link>
            <Link className="btn btn-primary" href="/tresci/nowy">
              <Icon name="upload" />
              Nowy film
            </Link>
          </>
        }
      />
      {typeof sp.usunieto === "string" ? (
        <div className="banner ok mb-3" role="status">
          <Icon name="ok" />
          <div className="banner-body">
            <span className="banner-title">Film usunięty</span>
            <span className="text-2">Wiersze w bazie i pliki w R2 (oryginał, wersje HLS, napisy) zostały skasowane. Wpis VIDEO_DELETED w audycie.</span>
          </div>
        </div>
      ) : null}
      {encoding.map((v) => (
        <div className="banner mb-3" key={v.id}>
          <Icon name="film" />
          <div className="banner-body">
            <span className="banner-title">Kodowanie w toku: „{v.title}”</span>
            <span className="text-2">Postęp na żywo, etap i log widać na stronie filmu.</span>
          </div>
          <Link className="btn btn-sm" href={`/tresci/${v.slug}`}>
            Podgląd
          </Link>
        </div>
      ))}
      <form className="filters" role="search" aria-label="Filtry filmów" method="get" action="/tresci">
        <label className="search-wrap">
          <span className="sr-only">Szukaj po tytule lub adresie</span>
          <Icon name="search" />
          <input className="input" type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Szukaj po tytule lub adresie" data-list-search />
        </label>
        <FilterSelect name="status" label="Status" value={filters.status} options={STATUS} />
        <FilterSelect name="tier" label="Dostęp" value={filters.tier} options={TIERS} />
        <FilterSelect name="hls" label="Wideo" value={filters.hls} options={HLS} />
        <FilterSelect name="sort" label="Sortowanie" value={filters.sort ?? "created"} options={SORTS} />
        <button className="btn" type="submit">
          <Icon name="filter" />
          Filtruj
        </button>
        {filtered ? (
          <Link className="btn btn-ghost" href="/tresci">
            Wyczyść
          </Link>
        ) : null}
      </form>
      <section className="card card-flush" aria-label="Lista filmów">
        {list.items.length === 0 ? (
          <Empty icon="film" title={filtered ? "Nic nie pasuje do filtrów" : "Nie ma jeszcze filmów"}>
            {filtered ? "Zmień albo wyczyść filtry." : <Link href="/tresci/nowy">Dodaj pierwszy film</Link>}
          </Empty>
        ) : (
          <div className="table-scroll">
            <table className="table responsive">
              <caption className="sr-only">Filmy</caption>
              <thead>
                <tr>
                  <th scope="col">Film</th>
                  <th scope="col">Status</th>
                  <th scope="col">Wideo (HLS)</th>
                  <th scope="col" className="hide-sm">Miniatura</th>
                  <th scope="col" className="hide-sm">Napisy</th>
                  <th scope="col" className="hide-md">Dostęp</th>
                  <th scope="col" className="hide-md">Publikacja</th>
                  <th scope="col" className="num">Obejrzenia</th>
                  <th scope="col" className="hide-sm">
                    <span className="sr-only">Otwórz</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((v) => {
                  const st = statusOf(v, now);
                  const hls = hlsOf(v);
                  const th = list.thumbs[v.id];
                  return (
                    <tr key={v.id}>
                      <td className="cell-first">
                        <div className="cell-title">
                          <span className="thumb" aria-hidden="true">
                            {/* eslint-disable-next-line @next/next/no-img-element -- panel preview route, private, no optimizer */}
                            <img src={thumbSrc(v)} alt="" loading="lazy" decoding="async" />
                          </span>
                          <div>
                            <Link href={`/tresci/${v.slug}`}>{v.title}</Link>
                            <div className="muted mono">{v.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Status">
                        <Badge kind={st.kind} icon={st.icon}>
                          {st.label}
                        </Badge>
                        {v.isMainFeatured ? (
                          <>
                            {" "}
                            <Badge kind="info" icon={false}>
                              Hero
                            </Badge>
                          </>
                        ) : null}
                      </td>
                      <td data-label="Wideo (HLS)">{hls.kind === "muted" ? <span className="muted">{hls.label}</span> : <State kind={hls.kind}>{hls.label}</State>}</td>
                      <td data-label="Miniatura" className="hide-sm">
                        {th ? (
                          <span title={th.detail}>
                            <State kind={th.kind}>{th.label}</State>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-label="Napisy" className="hide-sm">
                        {v.subtitleUrlPl ? <Badge kind="outline" icon={false}>PL</Badge> : null} {v.subtitleUrlEn ? <Badge kind="outline" icon={false}>EN</Badge> : null}
                        {!v.subtitleUrlPl && !v.subtitleUrlEn ? <span className="muted">brak</span> : null}
                      </td>
                      <td data-label="Dostęp" className="hide-md">{TIER_LABEL[v.tier] ?? v.tier}</td>
                      <td data-label="Publikacja" className="hide-md">{v.publishedAt ? fmtDateY(v.publishedAt) : <span className="muted">—</span>}</td>
                      <td data-label="Obejrzenia" className="num">{fmtInt(v.views)}</td>
                      <td className="actions hide-sm">
                        <Link className="btn btn-sm btn-ghost" href={`/tresci/${v.slug}`} aria-label={`Otwórz ${v.title}`}>
                          <Icon name="right" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {list.totalPages > 1 ? (
          <div className="pager">
            <span>
              Strona {list.page} z {list.totalPages} · {fmtInt(list.total)} filmów
            </span>
            <nav aria-label="Strony listy filmów">
              {list.page > 1 ? (
                <Link className="btn btn-sm" href={query(filters, { page: list.page - 1 })} aria-label="Poprzednia strona">
                  <Icon name="left" />
                </Link>
              ) : null}
              {Array.from({ length: list.totalPages }, (_, i) => i + 1)
                .filter((n) => Math.abs(n - list.page) <= 2 || n === 1 || n === list.totalPages)
                .map((n) => (
                  <Link key={n} className="btn btn-sm page-btn" href={query(filters, { page: n })} aria-current={n === list.page ? "page" : undefined}>
                    {n}
                  </Link>
                ))}
              {list.page < list.totalPages ? (
                <Link className="btn btn-sm" href={query(filters, { page: list.page + 1 })} aria-label="Następna strona">
                  <Icon name="right" />
                </Link>
              ) : null}
            </nav>
          </div>
        ) : null}
      </section>
    </>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string | undefined; options: readonly (readonly [string, string])[] }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select className="select" name={name} defaultValue={value ?? ""}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
