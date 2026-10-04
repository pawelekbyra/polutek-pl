import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUpcomingPremiere } from "@/lib/modules/video";
import { DangerZone } from "@admin/components/content/danger-zone";
import { FilmTabs } from "@admin/components/content/film-tabs";
import { FilmForm, type FilmFormValues } from "@admin/components/content/film-form";
import { CoverUpload, SubtitlesCard } from "@admin/components/content/media-cards";
import { OriginalUpload } from "@admin/components/content/original-upload";
import { Icon } from "@admin/components/icons";
import { PageHead } from "@admin/components/ui";
import { dateToWarsawLocal } from "@admin/lib/actions/panel";
import { loadContentDetail, thumbSrc } from "@admin/lib/content";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await loadContentDetail((await params).slug);
  return { title: d ? `Edycja · ${d.video.title}` : "Nie znaleziono" };
}

export default async function EditFilmPage({ params, searchParams }: Props) {
  const detail = await loadContentDetail((await params).slug);
  if (!detail) notFound();
  const sp = await searchParams;
  const { video: v, pipeline } = detail;
  const fundMode: FilmFormValues["fundMode"] = v.fundraisingManualPercent !== null ? "manual" : v.fundraisingGoalMinor ? "goal" : "off";
  const values: FilmFormValues = {
    id: v.id,
    updatedAt: new Date(v.updatedAt).toISOString(),
    status: v.status,
    title: v.title,
    slug: v.slug,
    titleEn: v.titleEn ?? "",
    description: v.description ?? "",
    descriptionEn: v.descriptionEn ?? "",
    tier: v.tier === "PUBLIC" ? "PUBLIC" : "LOGGED_IN",
    premiereLocal: dateToWarsawLocal(v.premiereAt ?? null),
    premiereUpcoming: isUpcomingPremiere(v),
    fundMode,
    fundPercent: v.fundraisingManualPercent !== null ? String(v.fundraisingManualPercent) : "",
    fundGoal: v.fundraisingGoalMinor ? String(v.fundraisingGoalMinor / 100).replace(".", ",") : "",
    fundCurrency: v.fundraisingGoalCurrency ?? "PLN",
    fundSince: v.fundraisingStartAt ? dateToWarsawLocal(v.fundraisingStartAt).slice(0, 10) : "",
    showInSidebar: v.showInSidebar,
    isMainFeatured: v.isMainFeatured,
    hlsReady: v.migrationStatus === "READY",
  };
  const isNew = typeof sp.nowy === "string";

  return (
    <>
      <PageHead
        title={`Edycja: ${v.title}`}
        crumbs={
          <>
            <Link href="/tresci">Treści</Link>
            <Icon name="right" />
            <Link href={`/tresci/${v.slug}`}>{v.title}</Link>
            <Icon name="right" />
            <span>Edycja</span>
          </>
        }
        lede="Jeden formularz na wszystkie pola tekstowe; pliki (oryginał, miniatura, napisy) zapisują się od razu po wgraniu."
        actions={
          <Link className="btn" href={`/tresci/${v.slug}`}>
            Wróć do filmu
          </Link>
        }
      />
      <FilmTabs slug={v.slug} current="edycja" />
      {isNew ? (
        <div className="banner ok mb-3" role="status">
          <Icon name="ok" />
          <div className="banner-body">
            <span className="banner-title">Szkic utworzony</span>
            <span className="text-2">Teraz wgraj oryginał poniżej; kodowanie ruszy samo. Publikacja dopiero, gdy lista kontrolna jest czysta.</span>
          </div>
        </div>
      ) : null}
      <div className="grid">
        <div className="span-8 stack">
          <OriginalUpload videoId={v.id} hasOriginal={!!pipeline?.original} canPublish={v.status === "DRAFT"} />
          <FilmForm v={values} />
        </div>
        <div className="span-4 stack">
          <CoverUpload videoId={v.id} title={v.title} src={thumbSrc(v)} />
          <SubtitlesCard videoId={v.id} slug={v.slug} pl={v.subtitleUrlPl ?? null} en={v.subtitleUrlEn ?? null} />
          <DangerZone id={v.id} slug={v.slug} title={v.title} archived={v.status === "ARCHIVED"} />
        </div>
      </div>
    </>
  );
}
