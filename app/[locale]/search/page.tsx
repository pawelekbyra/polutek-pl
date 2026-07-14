import Link from "next/link";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { VideoSearchService } from "@/lib/modules/video/application/video-search.service";
import { getLocalizedHref, isLocale, type Locale } from "@/lib/i18n/routing";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage(props: SearchPageProps) {
  const [{ locale: rawLocale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const rawQuery = searchParams.q ?? "";
  const normalizedQuery = VideoSearchService.normalizeQuery(rawQuery);
  const results = normalizedQuery
    ? await VideoSearchService.searchPublicVideos(rawQuery)
    : [];

  return (
    <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-[var(--chan-line)] pb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--chan-muted)]">
            Polutek.pl
          </p>
          <h1 className="font-brand text-3xl font-bold tracking-tight text-[var(--chan-ink)] sm:text-4xl">
            {locale === "pl" ? "Wyniki wyszukiwania" : "Search results"}
          </h1>
          {normalizedQuery ? (
            <p className="mt-3 text-sm text-[var(--chan-muted)]">
              {locale === "pl" ? `Znaleziono ${results.length} ${results.length === 1 ? "materiał" : "materiałów"} dla „` : `Found ${results.length} ${results.length === 1 ? "result" : "results"} for “`}
              {rawQuery.trim()}{locale === "pl" ? "”." : ".”"}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--chan-muted)]">
              {locale === "pl" ? "Wpisz frazę w wyszukiwarce, aby znaleźć publiczne materiały." : "Enter a phrase to find public videos."}
            </p>
          )}
        </div>

        {!normalizedQuery ? (
          <EmptySearchState locale={locale} message={locale === "pl" ? "Brak zapytania do wyszukania." : "No search query."} />
        ) : results.length === 0 ? (
          <EmptySearchState locale={locale} message={locale === "pl" ? "Nie znaleziono publicznych materiałów dla tej frazy." : "No public videos found for this phrase."} />
        ) : (
          <div className="grid gap-4">
            {results.map((video) => (
              <Link
                key={video.id}
                href={getLocalizedHref(locale, "watch", { slug: video.slug || video.id })}
                className="group flex gap-4 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-3 transition hover:bg-[var(--chan-surface)]"
              >
                <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl bg-[var(--chan-ink)] sm:h-32 sm:w-56">
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt={`Miniatura filmu: ${locale === "en" ? (video.titleEn || video.title) : video.title}`}
                      fill
                      sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 100vw"
                      className="object-cover opacity-90 transition duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 py-1">
                  <h2 className="line-clamp-2 font-brand text-lg font-bold text-[var(--chan-ink)] group-hover:underline">
                    {locale === "en" ? (video.titleEn || video.title) : video.title}
                  </h2>
                  {video.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--chan-body)]">
                      {locale === "en" ? (video.descriptionEn || video.description) : video.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--chan-muted)]">
                    {video.creator?.name ?? "Polutek"} ·{" "}
                    {video.views.toLocaleString(locale === "pl" ? "pl-PL" : "en-US")} {locale === "pl" ? "wyświetleń" : "views"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function EmptySearchState({ message, locale }: { message: string; locale: Locale }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--chan-line)] bg-[var(--chan-card)] p-10 text-center">
      <p className="mb-6 text-sm text-[var(--chan-muted)]">{message}</p>
      <Link
        href={getLocalizedHref(locale, "home")}
        className="inline-flex rounded-full bg-[var(--chan-ink)] px-6 py-3 font-brand text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90"
      >
        {locale === "pl" ? "Wróć na kanał" : "Back to channel"}
      </Link>
    </div>
  );
}
