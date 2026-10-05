import Link from "next/link";
import { CommentList } from "@admin/components/community/comment-list";
import { Pager } from "@admin/components/community/pager";
import { Icon } from "@admin/components/icons";
import { Empty } from "@admin/components/ui";
import { loadComments, loadFilmOptions } from "@admin/lib/community";
import { withParams } from "@admin/lib/community-format";

const STATUS: [string, string][] = [["", "Każdy status"], ["VISIBLE", "Widoczne"], ["HIDDEN", "Ukryte"], ["HELD_FOR_REVIEW", "Wstrzymane"], ["DELETED", "Usunięte"], ["Q", "Pytania bez odpowiedzi"]];

export async function CommentsTab({ q, status, vid, autor, page }: { q: string; status: string; vid: string; autor: string; page: number }) {
  const films = await loadFilmOptions();
  const list = await loadComments({ q, status, videoId: films.find((x) => x.slug === vid)?.id, authorId: autor || undefined, page });
  const params = { tab: "komentarze", q, status, vid, autor };
  const here = withParams("/spolecznosc", { ...params, page: page > 1 ? page : undefined });
  return (
    <>
      <form className="filters" role="search" aria-label="Filtry komentarzy" method="get" action="/spolecznosc">
        <input type="hidden" name="tab" value="komentarze" />
        {autor ? <input type="hidden" name="autor" value={autor} /> : null}
        <label className="search-wrap">
          <span className="sr-only">Szukaj w treści lub po autorze</span>
          <Icon name="search" />
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Szukaj w treści lub autorze" />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select className="select" name="status" defaultValue={status}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label>
          <span className="sr-only">Film</span>
          <select className="select" name="vid" defaultValue={vid}>
            <option value="">Wszystkie filmy</option>
            {films.map((f) => <option key={f.id} value={f.slug}>{f.title}</option>)}
          </select>
        </label>
        <button className="btn" type="submit"><Icon name="filter" />Filtruj</button>
        {autor ? <span className="badge info">Komentarze jednej osoby</span> : null}
        {q || status || vid || autor ? <Link className="btn btn-ghost" href="/spolecznosc?tab=komentarze">Wyczyść filtry</Link> : null}
      </form>
      {list.items.length === 0 ? (
        <section className="card"><Empty icon="message" title="Brak komentarzy dla tych filtrów" /></section>
      ) : (
        <CommentList items={list.items} returnPath={here} />
      )}
      <div className="card card-flush mt-3"><Pager page={list.page} pageSize={list.pageSize} total={list.total} totalPages={list.totalPages} href={(p) => withParams("/spolecznosc", { ...params, page: p > 1 ? p : undefined })} noun="komentarzy" /></div>
    </>
  );
}
