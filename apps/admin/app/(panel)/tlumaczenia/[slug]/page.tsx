import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TranslationsTable } from "@admin/components/content/translations-table";
import { Icon } from "@admin/components/icons";
import { PageHead } from "@admin/components/ui";
import { requireAdmin } from "@admin/lib/auth/guard";
import { loadFilmTranslations } from "@admin/lib/content";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Tłumaczenie filmu" };

/** One film for a translator: only the granted languages, no approving, no subtitles, no AI. */
export default async function TranslatorFilmPage({ params }: Props) {
  const viewer = await requireAdmin("/tlumaczenia", { roles: ["OWNER", "TRANSLATOR"] });
  const data = await loadFilmTranslations((await params).slug);
  if (!data) notFound();
  const { video: v } = data;
  const rows = data.rows.filter((r) => viewer.role === "OWNER" || viewer.languages.includes(r.language.code));
  return (
    <>
      <PageHead title={v.title} crumbs={<><Link href="/tlumaczenia">Do przetłumaczenia</Link><Icon name="right" /><span>{v.title}</span></>} lede="Przetłumacz tytuł, adres i opis. Zatwierdza właściciel kanału." />
      <TranslationsTable
        mode={viewer.role === "OWNER" ? "owner" : "translator"}
        videoId={v.id}
        filmSlug={v.slug}
        original={{ title: v.title, slug: v.slug, hasSubtitles: !!v.subtitleUrlPl }}
        rows={rows.map((r) => ({ code: r.language.code, label: r.language.label, namePl: r.language.namePl, flag: r.language.flag, translation: r.translation ? { title: r.translation.title, slug: r.translation.slug, description: r.translation.description, subtitleUrl: r.translation.subtitleUrl, status: r.translation.status } : null }))}
      />
    </>
  );
}
