import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmTabs } from "@admin/components/content/film-tabs";
import { TranslationsTable } from "@admin/components/content/translations-table";
import { Icon } from "@admin/components/icons";
import { PageHead } from "@admin/components/ui";
import { loadFilmTranslations } from "@admin/lib/content";
import { draftAiStatus } from "@/lib/modules/translations";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await loadFilmTranslations((await params).slug);
  return { title: d ? `Tłumaczenia · ${d.video.title}` : "Nie znaleziono" };
}

export default async function FilmTranslationsPage({ params }: Props) {
  const data = await loadFilmTranslations((await params).slug);
  if (!data) notFound();
  const { video: v, rows } = data;
  return (
    <>
      <PageHead
        title={`Tłumaczenia: ${v.title}`}
        crumbs={
          <>
            <Link href="/tresci">Treści</Link>
            <Icon name="right" />
            <Link href={`/tresci/${v.slug}`}>{v.title}</Link>
            <Icon name="right" />
            <span>Tłumaczenia</span>
          </>
        }
        lede="Wersja polska jest źródłem. Każdy język ma swój tytuł, adres, opis i napisy; szkic automatyczny trzeba zatwierdzić."
      />
      <FilmTabs slug={v.slug} current="tlumaczenia" />
      <TranslationsTable
        ai={draftAiStatus()}
        videoId={v.id}
        filmSlug={v.slug}
        original={{ title: v.title, slug: v.slug, hasSubtitles: !!v.subtitleUrlPl }}
        rows={rows.map((r) => ({
          code: r.language.code,
          label: r.language.label,
          namePl: r.language.namePl,
          flag: r.language.flag,
          translation: r.translation ? { title: r.translation.title, slug: r.translation.slug, description: r.translation.description, subtitleUrl: r.translation.subtitleUrl, status: r.translation.status } : null,
        }))}
      />
    </>
  );
}
