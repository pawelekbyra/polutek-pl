import Link from "next/link";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { VideoSearchService } from "@/lib/modules/video/application/video-search.service";
import { getLocalizedHref, isLocale, toContentLocale, type Locale } from "@/lib/i18n/routing";
import { getServerTx } from "@/lib/i18n/server-tx";
import { countedNoun } from "@/lib/i18n/plurals";
import { intlLocale, type Tx } from "@/lib/i18n/ui";
import { getVideoDisplayDescription, getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { notFound } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { auth } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage(props: SearchPageProps) {
  const [{ locale: rawLocale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const tx = await getServerTx(locale);
  const contentLocale = toContentLocale(locale);
  const rawQuery = searchParams.q ?? "";
  const normalizedQuery = VideoSearchService.normalizeQuery(rawQuery);
  // The viewer's session goes into the first HTML, so the navbar renders final (no loading state).
  const [results, session] = await Promise.all([
    normalizedQuery ? VideoSearchService.searchPublicVideos(rawQuery) : Promise.resolve([]),
    auth(),
  ]);

  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
    <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
      <Navbar initialQuery={rawQuery} />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-[var(--chan-line)] pb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--chan-muted)]">
            {APP_NAME}
          </p>
          <h1 className="font-brand text-3xl font-bold tracking-tight text-[var(--chan-ink)] sm:text-4xl">
            {tx("Wyniki wyszukiwania", "Search results")}
          </h1>
          {normalizedQuery ? (
            <p className="mt-3 text-sm text-[var(--chan-muted)]">
              {tx("Wyniki dla „{0}”: {1}", "Results for “{0}”: {1}", rawQuery.trim(), results.length)}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--chan-muted)]">
              {tx("Wpisz frazę w wyszukiwarce, aby znaleźć publiczne materiały.", "Enter a phrase to find public videos.")}
            </p>
          )}
        </div>

        {!normalizedQuery ? (
          <EmptySearchState locale={locale} tx={tx} message={tx("Brak zapytania do wyszukania.", "No search query.")} />
        ) : results.length === 0 ? (
          <EmptySearchState locale={locale} tx={tx} message={tx("Nie znaleziono publicznych materiałów dla tej frazy.", "No public videos found for this phrase.")} />
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
                      alt={tx("Miniatura filmu: {0}", "Video thumbnail: {0}", getVideoDisplayTitle(video, contentLocale))}
                      fill
                      sizes="(min-width: 640px) 224px, 160px"
                      className="object-cover opacity-90 transition duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 py-1">
                  <h2 className="line-clamp-2 font-brand text-lg font-bold text-[var(--chan-ink)] group-hover:underline">
                    {getVideoDisplayTitle(video, contentLocale)}
                  </h2>
                  {video.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--chan-body)]">
                      {getVideoDisplayDescription(video, contentLocale) || video.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--chan-muted)]">
                    {video.creator?.name ?? "PawelPerfect"} ·{" "}
                    {video.views.toLocaleString(intlLocale(locale))} {countedNoun(locale, "views", video.views)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
    </AuthSessionSeedProvider>
  );
}

function EmptySearchState({ message, locale, tx }: { message: string; locale: Locale; tx: Tx }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--chan-line)] bg-[var(--chan-card)] p-10 text-center">
      <p className="mb-6 text-sm text-[var(--chan-muted)]">{message}</p>
      <Link
        href={getLocalizedHref(locale, "home")}
        className="inline-flex rounded-full bg-[var(--chan-ink)] px-6 py-3 font-brand text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90"
      >
        {tx("Wróć na kanał", "Back to channel")}
      </Link>
    </div>
  );
}
