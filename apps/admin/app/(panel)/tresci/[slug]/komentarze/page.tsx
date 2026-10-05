import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentList } from "@admin/components/community/comment-list";
import { Pager } from "@admin/components/community/pager";
import { FilmTabs } from "@admin/components/content/film-tabs";
import { Icon } from "@admin/components/icons";
import { Empty, PageHead } from "@admin/components/ui";
import { loadComments, loadFilm } from "@admin/lib/community";
import { withParams } from "@admin/lib/community-format";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await loadFilm((await params).slug);
  return { title: f ? `Komentarze · ${f.title}` : "Nie znaleziono" };
}

/** Comments of one film with the same moderation as Społeczność → Komentarze (the old tab was dead, ADM-06). */
export default async function FilmCommentsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const film = await loadFilm(slug);
  if (!film) notFound();
  const status = one(sp.status);
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  const list = await loadComments({ status, videoId: film.id, page });
  const base = `/tresci/${slug}/komentarze`;
  return (
    <>
      <PageHead title={film.title} crumbs={<><Link href="/tresci">Treści</Link><Icon name="right" /><span>{film.title}</span></>} lede="Komentarze pod tym filmem." />
      <FilmTabs slug={slug} current="komentarze" />
      <form className="filters" role="search" aria-label="Filtry komentarzy" method="get" action={base}>
        <label>
          <span className="sr-only">Status</span>
          <select className="select" name="status" defaultValue={status}>
            <option value="">Każdy status</option><option value="VISIBLE">Widoczne</option><option value="HIDDEN">Ukryte</option><option value="HELD_FOR_REVIEW">Wstrzymane</option><option value="Q">Pytania bez odpowiedzi</option>
          </select>
        </label>
        <button className="btn" type="submit"><Icon name="filter" />Filtruj</button>
      </form>
      {list.items.length === 0 ? <section className="card"><Empty icon="message" title="Brak komentarzy dla tego filtru" /></section> : <CommentList items={list.items} videoSlug={slug} returnPath={withParams(base, { status, page: page > 1 ? page : undefined })} />}
      <div className="card card-flush mt-3"><Pager page={list.page} pageSize={list.pageSize} total={list.total} totalPages={list.totalPages} href={(p) => withParams(base, { status, page: p > 1 ? p : undefined })} noun="komentarzy" /></div>
    </>
  );
}
