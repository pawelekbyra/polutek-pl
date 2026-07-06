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
    <div className="min-h-screen paper-surface font-sans ink-text">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 border-b paper-border pb-6">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] muted-text">
            Polutek.pl
          </p>
          <h1 className="text-3xl font-black tracking-tight ink-text sm:text-4xl">
            {locale === "pl" ? "Wyniki wyszukiwania" : "Search results"}
          </h1>
          {normalizedQuery ? (
            <p className="mt-3 text-sm muted-text">
              {locale === "pl" ? `Znaleziono ${results.length} ${results.length === 1 ? "materiał" : "materiałów"} dla „` : `Found ${results.length} ${results.length === 1 ? "result" : "results"} for “`}
              {rawQuery.trim()}{locale === "pl" ? "”." : ".”"}
            </p>
          ) : (
            <p className="mt-3 text-sm muted-text">
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
                className="group flex gap-4 paper-radius-panel border paper-border paper-panel p-3 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition hover:border-[var(--najs-paper-line)] hover:bg-[rgba(241,234,217,0.86)] hover:shadow-[0_8px_22px_rgba(23,23,23,0.06)]"
              >
                <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl ink-button sm:h-32 sm:w-56">
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
                  <h2 className="line-clamp-2 text-lg font-black tracking-tight ink-text group-hover:underline">
                    {locale === "en" ? (video.titleEn || video.title) : video.title}
                  </h2>
                  {video.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 muted-text">
                      {locale === "en" ? (video.descriptionEn || video.description) : video.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs font-bold uppercase tracking-widest muted-text">
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
    <div className="rounded-3xl border border-dashed paper-border paper-panel p-10 text-center shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <p className="mb-6 text-sm muted-text">{message}</p>
      <Link
        href={getLocalizedHref(locale, "home")}
        className="inline-flex rounded-full ink-button px-6 py-3 text-xs font-black uppercase tracking-widest text-[var(--najs-paper)] transition hover:bg-[rgba(23,23,23,0.9)]"
      >
        {locale === "pl" ? "Wróć na kanał" : "Back to channel"}
      </Link>
    </div>
  );
}
