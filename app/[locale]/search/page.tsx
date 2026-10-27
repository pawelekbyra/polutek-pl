import Link from "next/link";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import SearchFilters from "@/app/components/search/SearchFilters";
import VideoTaxonomyChips from "@/app/components/search/VideoTaxonomyChips";
import { CreatorContentService } from "@/lib/modules/channel/infrastructure/creator-content.service";
import {
  getSearchFacets,
  hasSearchCriteria,
  parsePublicSearchParams,
  searchPublicVideos,
  type PublicSearchPage,
  type PublicSearchParams,
  type SearchFacets,
} from "@/lib/modules/video";
import { getLocalizedHref, isLocale, toContentLocale, type Locale } from "@/lib/i18n/routing";
import { getServerTx } from "@/lib/i18n/server-tx";
import { countedNoun } from "@/lib/i18n/plurals";
import { intlLocale, type Tx } from "@/lib/i18n/ui";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { buildSearchQuery } from "@/lib/search-href";
import { videoCategoryLabel } from "@/lib/video-category-label";
import { toVideoAccessTier } from "@/lib/access-tier";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/api/client-ip";
import { takeSearchBudget } from "@/lib/search-rate-limit";
import { APP_NAME } from "@/lib/constants";
import { auth } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const softChip =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--chan-line)] bg-[var(--chan-card)] px-3 py-1.5 text-xs font-semibold text-[var(--chan-ink)] transition hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]";

export default async function SearchPage(props: SearchPageProps) {
  const [{ locale: rawLocale }, rawParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const tx = await getServerTx(locale);
  const params = parsePublicSearchParams(rawParams);
  const criteria = hasSearchCriteria(params);

  // The viewer's session goes into the first HTML, so the navbar renders final (no loading state).
  const session = await auth();
  const viewer = { signedIn: Boolean(session?.user) };

  let page: PublicSearchPage | null = null;
  let facets: SearchFacets | null = null;
  let failed = false;
  try {
    // Same request budget as GET /api/search (W01): the page must not be a way around the API limit. Browsing the
    // facets (no search criteria) does not run a search and is not counted.
    if (criteria && !(await takeSearchBudget(getClientIp(await headers()))).success) throw new Error("search rate limited");
    [page, facets] = await Promise.all([
      criteria ? searchPublicVideos(params, viewer) : Promise.resolve(null),
      criteria ? Promise.resolve(null) : getSearchFacets(viewer),
    ]);
  } catch (error) {
    console.error("[SEARCH_PAGE_ERROR]", error);
    failed = true;
  }
  const channels =
    params.q && !params.cursor && !failed ? await CreatorContentService.searchPublicChannels(params.q).catch(() => []) : [];

  const searchPath = getLocalizedHref(locale, "search");
  const hrefFor = (next: Partial<PublicSearchParams>) => {
    const query = buildSearchQuery({ ...params, cursor: null, ...next });
    return query ? `${searchPath}?${query}` : searchPath;
  };

  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
    <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
      <Navbar initialQuery={params.q} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl focus:outline-none px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--chan-muted)]">{APP_NAME}</p>
          <h1 className="font-brand text-3xl font-bold tracking-tight text-[var(--chan-ink)] sm:text-4xl">
            {tx("Wyniki wyszukiwania", "Search results")}
          </h1>
          <p className="mt-3 text-sm text-[var(--chan-muted)]">
            {params.q
              ? tx("Wyniki dla „{0}”", "Results for “{0}”", params.q)
              : tx("Wpisz frazę w wyszukiwarce, aby znaleźć publiczne materiały.", "Enter a phrase to find public videos.")}
          </p>
        </div>

        <SearchFilters
          value={{
            q: params.q,
            category: params.category ?? "",
            duration: params.duration ?? "",
            uploaded: params.uploaded ?? "",
            sort: params.sort,
            tag: params.tag ?? "",
            channel: params.channel ?? "",
          }}
        />

        <ActiveFilters params={params} hrefFor={hrefFor} tx={tx} />

        <div className="mt-6">
          {failed ? (
            <div role="alert" className="rounded-3xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-8 text-center">
              <p className="mb-5 text-sm text-[var(--chan-ink)]">{tx("Nie udało się wyszukać. Spróbuj ponownie za chwilę.", "Search failed. Please try again in a moment.")}</p>
              <Link href={hrefFor({ cursor: params.cursor })} className={softChip}>
                {tx("Spróbuj ponownie", "Try again")}
              </Link>
            </div>
          ) : !criteria ? (
            <BrowseStart facets={facets} locale={locale} tx={tx} />
          ) : page && page.items.length === 0 && channels.length === 0 ? (
            <EmptyState locale={locale} tx={tx} clearHref={params.q ? hrefFor({ category: null, tag: null, channel: null, duration: null, uploaded: null }) : searchPath} />
          ) : (
            <div className="grid gap-4">
              {channels.length > 0 ? (
                <section aria-label={tx("Kanały", "Channels")} className="grid gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--chan-muted)]">{tx("Kanały", "Channels")}</h2>
                  {channels.map((channel) => (
                    <Link
                      key={channel.id}
                      href={getLocalizedHref(locale, "channel", { slug: channel.slug })}
                      className="flex items-center justify-between rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-4 py-3 transition hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
                    >
                      <span className="font-brand text-base font-bold text-[var(--chan-ink)]">{channel.name}</span>
                      <span className="text-sm text-[var(--chan-muted)]">@{channel.handle ?? channel.slug}</span>
                    </Link>
                  ))}
                </section>
              ) : null}
              {page?.items.map((video) => {
                const gated = toVideoAccessTier(video.tier) !== "PUBLIC" && !viewer.signedIn;
                const title = getVideoDisplayTitle(video, toContentLocale(locale));
                return (
                  <article
                    key={video.id}
                    className="group relative flex gap-4 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-3 transition hover:bg-[var(--chan-surface)]"
                  >
                    <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl bg-[var(--chan-ink)] sm:h-32 sm:w-56">
                      {video.thumbnailUrl ? (
                        <Image
                          src={video.thumbnailUrl}
                          alt={tx("Miniatura filmu: {0}", "Video thumbnail: {0}", title)}
                          fill
                          sizes="(min-width: 640px) 224px, 160px"
                          className="object-cover opacity-90 transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
                        />
                      ) : null}
                      {video.duration ? (
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-bold text-white">{video.duration}</span>
                      ) : null}
                      {video.isAdult ? (
                        <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-[3px] text-[9px] font-black leading-none tracking-[0.1em] text-white">18+</span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <h2 className="line-clamp-2 font-brand text-lg font-bold text-[var(--chan-ink)] group-hover:underline">
                        <Link
                          href={getLocalizedHref(locale, "watch", { slug: video.slug || video.id })}
                          className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
                        >
                          {title}
                        </Link>
                      </h2>
                      {video.snippet ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--chan-body)]">{video.snippet}</p> : null}
                      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--chan-muted)]">
                        {video.creator?.name ?? APP_NAME} · {video.views.toLocaleString(intlLocale(locale))} {countedNoun(locale, "views", video.views)}
                        {gated ? <> · {tx("Logowanie", "Login")}</> : null}
                      </p>
                      <VideoTaxonomyChips category={video.category} tags={video.tags} locale={locale} tx={tx} maxTags={4} className="relative z-10 mt-2" />
                    </div>
                  </article>
                );
              })}
              {page?.nextCursor ? (
                <div className="flex justify-center pt-2">
                  <Link href={hrefFor({ cursor: page.nextCursor })} rel="next" className={softChip}>
                    {tx("Więcej wyników", "More results")}
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
    </AuthSessionSeedProvider>
  );
}

function ActiveFilters({ params, hrefFor, tx }: { params: PublicSearchParams; hrefFor: (next: Partial<PublicSearchParams>) => string; tx: Tx }) {
  const items: { key: string; label: string; href: string }[] = [];
  if (params.category) items.push({ key: "category", label: videoCategoryLabel(tx, params.category), href: hrefFor({ category: null }) });
  if (params.tag) items.push({ key: "tag", label: tx("Tag: {0}", "Tag: {0}", params.tag), href: hrefFor({ tag: null }) });
  if (params.channel) items.push({ key: "channel", label: tx("Kanał: {0}", "Channel: {0}", params.channel), href: hrefFor({ channel: null }) });
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label={tx("Aktywne filtry", "Active filters")}>
      {items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} className={softChip} aria-label={tx("Usuń filtr: {0}", "Remove filter: {0}", item.label)}>
            {item.label}
            <span aria-hidden="true" className="text-[var(--chan-muted)]">×</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BrowseStart({ facets, locale, tx }: { facets: SearchFacets | null; locale: Locale; tx: Tx }) {
  const searchPath = getLocalizedHref(locale, "search");
  const hasAny = Boolean(facets && (facets.categories.length > 0 || facets.tags.length > 0));
  if (!hasAny) return <EmptyState locale={locale} tx={tx} clearHref={null} />;
  return (
    <div className="grid gap-6">
      {facets && facets.categories.length > 0 ? (
        <section aria-label={tx("Przeglądaj kategorie", "Browse categories")} className="grid gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--chan-muted)]">{tx("Przeglądaj kategorie", "Browse categories")}</h2>
          <ul className="flex flex-wrap gap-2">
            {facets.categories.map((category) => (
              <li key={category.key}>
                <Link href={`${searchPath}?${buildSearchQuery({ category: category.key })}`} className={softChip}>
                  {videoCategoryLabel(tx, category.key)}
                  <span className="tabular-nums text-[var(--chan-muted)]">{category.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {facets && facets.tags.length > 0 ? (
        <section aria-label={tx("Popularne tagi", "Popular tags")} className="grid gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--chan-muted)]">{tx("Popularne tagi", "Popular tags")}</h2>
          <ul className="flex flex-wrap gap-2">
            {facets.tags.map((entry) => (
              <li key={entry.tag}>
                <Link href={`${searchPath}?${buildSearchQuery({ tag: entry.tag })}`} className={softChip}>
                  #{entry.tag}
                  <span className="tabular-nums text-[var(--chan-muted)]">{entry.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EmptyState({ locale, tx, clearHref }: { locale: Locale; tx: Tx; clearHref: string | null }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--chan-line)] bg-[var(--chan-card)] p-10 text-center">
      <p className="mb-6 text-sm text-[var(--chan-muted)]">
        {tx("Nie znaleziono filmów dla tych kryteriów. Zmień frazę lub filtry.", "No videos match these criteria. Change the phrase or filters.")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {clearHref ? (
          <Link href={clearHref} className={softChip}>
            {tx("Wyczyść filtry", "Clear filters")}
          </Link>
        ) : null}
        <Link
          href={getLocalizedHref(locale, "home")}
          className="inline-flex rounded-full bg-[var(--chan-ink)] px-6 py-3 font-brand text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2"
        >
          {tx("Wróć na kanał", "Back to channel")}
        </Link>
      </div>
    </div>
  );
}
