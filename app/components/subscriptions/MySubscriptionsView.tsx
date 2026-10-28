import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import ChannelVideoCard from "@/app/components/ChannelVideoCard";
import MySubscriptionsList, { type MySubscriptionRow } from "@/app/components/subscriptions/MySubscriptionsList";
import { auth } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { ListMySubscriptionsUseCase } from "@/lib/modules/subscriptions";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";
import type { PublicVideoDTO } from "@/app/types/video";
import { getServerTx } from "@/lib/i18n/server-tx";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { APP_NAME } from "@/lib/constants";

/** Latest videos of the subscribed channels shown below the list. */
const FEED_LIMIT = 30;

export type MySubscriptionsPageProps = { params: Promise<{ locale: string }> };

/** The page is personal: never indexed, never cached. */
export async function mySubscriptionsMetadata(props: MySubscriptionsPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await props.params;
  const locale = (await resolvePageLocale(rawLocale)) ?? "pl";
  const tx = await getServerTx(locale);
  return {
    title: `${tx("Moje subskrypcje", "My subscriptions")} · ${APP_NAME}`,
    robots: { index: false, follow: false },
  };
}

export default async function MySubscriptionsView(props: MySubscriptionsPageProps) {
  const { locale: rawLocale } = await props.params;
  const locale = await resolvePageLocale(rawLocale);
  if (!locale) notFound();
  const tx = await getServerTx(locale);

  // The proxy only checks that a session cookie exists; the page validates the session for real.
  const session = await auth();
  if (!session.userId) {
    redirect(`/?signin=1&next=${encodeURIComponent(getLocalizedHref(locale, "subscriptions"))}`);
  }

  let rows: MySubscriptionRow[] = [];
  let feed: PublicVideoDTO[] = [];
  let loadFailed = false;
  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const subscriptions = await ListMySubscriptionsUseCase.execute(ctx);
    rows = subscriptions.map((s) => ({
      creatorId: s.creatorId,
      slug: s.slug,
      handle: s.handle,
      name: s.name,
      imageUrl: s.imageUrl,
      notify: s.notify,
      videosCount: s.videosCount,
      lastVideoAt: s.lastVideoAt ? s.lastVideoAt.toISOString() : null,
      available: s.available,
    }));
    feed = await VideoContentService.getLatestPublicVideosForChannels(
      subscriptions.filter((s) => s.available).map((s) => s.creatorId),
      FEED_LIMIT,
    );
  } catch (error) {
    console.error("[MY_SUBSCRIPTIONS_PAGE_ERROR]", error);
    loadFailed = true;
  }

  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
      <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
        <Navbar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-10 focus:outline-none sm:px-6 lg:px-8">
          <h1 className="font-brand text-3xl font-bold tracking-tight text-[var(--chan-ink)] sm:text-4xl">
            {tx("Moje subskrypcje", "My subscriptions")}
          </h1>

          {loadFailed ? (
            <p role="alert" className="mt-8 text-[15px] text-[var(--chan-muted)]">
              {tx("Nie udało się wczytać subskrypcji. Odśwież stronę.", "Could not load your subscriptions. Please reload the page.")}
            </p>
          ) : (
            <>
              <section className="mt-8" aria-labelledby="subs-channels">
                <h2 id="subs-channels" className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-[var(--chan-muted)]">
                  {tx("Kanały", "Channels")}
                </h2>
                <MySubscriptionsList initialRows={rows} />
              </section>

              {rows.length > 0 && (
                <section className="mt-12" aria-labelledby="subs-latest">
                  <h2 id="subs-latest" className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-[var(--chan-muted)]">
                    {tx("Najnowsze filmy", "Latest videos")}
                  </h2>
                  {feed.length > 0 ? (
                    <div className="grid grid-cols-1 gap-x-5 gap-y-8 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {feed.map((video, index) => (
                        <ChannelVideoCard key={video.id} video={video} isLoggedIn index={index} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-[15px] text-[var(--chan-muted)]">
                      {tx("Subskrybowane kanały nie mają jeszcze filmów.", "Your subscribed channels have no videos yet.")}
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </AuthSessionSeedProvider>
  );
}
