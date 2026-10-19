import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import { auth } from "@/lib/auth/server";
import { Metadata } from 'next';
import { PublicVideoDTO } from '@/app/types/video';
import Link from 'next/link';
import { SafeAvatar } from '@/app/components/SafeAvatar';
import { CreatorContentService as ContentService } from '@/lib/modules/channel/infrastructure/creator-content.service';
import { getOrCreateCurrentUser } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import ChannelVideoCard from '@/app/components/ChannelVideoCard';
import { formatCount, getBaseUrl } from '@/lib/utils';
import SubscribeButton from '@/app/components/SubscribeButton';
import ReportButton from '@/app/components/ReportButton';
import { prisma } from '@/lib/prisma';
import { getLocaleAlternates, getLocalizedHref, isLocale, type Locale } from '@/lib/i18n/routing';
import { SITE_TITLE } from '@/lib/constants';
import { getServerTx } from '@/lib/i18n/server-tx';
import { countedNoun } from '@/lib/i18n/plurals';
import { notFound, redirect } from 'next/navigation';
import ChannelTabs from '@/app/components/channel/ChannelTabs';
import ChannelAbout from '@/app/components/channel/ChannelAbout';
import ChannelPlaylistsSection from '@/app/components/playlists/ChannelPlaylistsSection';
import { buildChannelFeedPath } from '@/lib/embed/paths';

export const revalidate = 60;

export async function generateMetadata(props: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  if (!isLocale(params.locale)) notFound();
  const locale: Locale = params.locale;
  const tx = await getServerTx(locale);
  const creator = await ContentService.getCreatorBySlug(params.slug).catch(() => null);
  if (!creator) return { title: SITE_TITLE };

  const baseUrl = getBaseUrl();

  // Social preview picture: the banner when the channel has one, otherwise its avatar (absolute address).
  const previewPath = creator.about?.bannerImageUrl ?? creator.imageUrl ?? null;
  const previewImage = previewPath ? (previewPath.startsWith('/') ? `${baseUrl}${previewPath}` : previewPath) : null;
  const canonicalPath = getLocaleAlternates(locale, "channel", { params: { slug: creator.slug }, baseUrl }).canonical;

  return {
    // Browser tab always reads www.pawelperfect.com; creator name stays in OG/twitter below.
    title: SITE_TITLE,
    alternates: {
      ...getLocaleAlternates(locale, "channel", { params: { slug: creator.slug }, baseUrl }),
      // Feed readers discover the channel's RSS feed here.
      types: { 'application/rss+xml': `${baseUrl}${buildChannelFeedPath(creator.slug)}` },
    },
    description: creator.bio ?? (tx("Kanał {0} — materiały wideo", "{0} video channel", creator.name)),
    openGraph: {
      title: creator.name,
      description: creator.bio ?? (tx("Kanał {0}", "{0} channel", creator.name)),
      type: 'website',
      url: canonicalPath,
      ...(previewImage ? { images: [{ url: previewImage, alt: creator.name }] } : {}),
    },
    twitter: {
      card: creator.about?.bannerImageUrl ? 'summary_large_image' : 'summary',
      title: creator.name,
      ...(previewImage ? { images: [previewImage] } : {}),
    },
  };
}

export default async function ChannelPage(props: { params: Promise<{ locale: string; slug: string }> }) {
  const params = await props.params;
  if (!isLocale(params.locale)) notFound();
  const locale: Locale = params.locale;
  const tx = await getServerTx(locale);
  let authState: { userId: string | null } = { userId: null };
  try {
    authState = await auth();
  } catch {
    authState = { userId: null };
  }

  const creator = await ContentService.getCreatorBySlug(params.slug).catch(() => null);
  const userId = authState.userId;

  if (!creator) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--chan-nav)] text-[var(--chan-ink)] font-sans">
        <Navbar />
        <main id="main" tabIndex={-1} className="flex-1 flex flex-col items-center justify-center p-4 text-center focus:outline-none">
            <h1 className="font-brand text-4xl font-bold">{tx("Kanał nie znaleziony", "Channel not found")}</h1>
            <p className="text-[var(--chan-muted)] mt-2 mb-6">{tx("Ten kanał nie istnieje.", "This channel does not exist.")}</p>
            <Link href={getLocalizedHref(locale, "home")} className="bg-[var(--chan-ink)] text-white px-8 py-3 rounded-xl font-brand font-bold tracking-wide hover:opacity-90 transition-all">{tx("Wróć na stronę główną", "Back home")}</Link>
        </main>
        <Footer />
      </div>
    );
  }

  // /channel/<old handle> and /@<old handle> lead to the channel's stable address (the handle history keeps
  // a released handle reserved for 180 days). The slug and the current handle are served as they are.
  const asked = params.slug.toLowerCase();
  if (creator.slug.toLowerCase() !== asked && (creator.handle ?? '').toLowerCase() !== asked) {
    redirect(getLocalizedHref(locale, 'channel', { slug: creator.slug }));
  }

  const userCtx = createAppContext();
  const [, initialSubscription] = await Promise.all([
    userId ? getOrCreateCurrentUser(userCtx, userId).catch(() => null) : Promise.resolve(null),
    userId
      ? prisma.subscription.findUnique({
          where: { userId_creatorId: { userId, creatorId: creator.id } },
          select: { id: true, notify: true },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const freshCreator = await prisma.creator.findUnique({
      where: { id: creator.id },
      select: { subscribersCount: true, displaySubscribersCount: true }
  }).catch(() => null);

  if (freshCreator) {
      creator.subscribersCount = freshCreator.subscribersCount;
  }
  // The channel's own avatar from the public creator DTO (resolveChannelAvatarUrl, same as the home
  // page strip). Never the signed-in viewer's image.
  const channelAvatar = creator.imageUrl || null;

  const allVideos: PublicVideoDTO[] = (creator.videos || []).map((v: PublicVideoDTO) => ({
    ...v,
    creator: {
      id: creator.id,
      name: creator.name,
      slug: creator.slug,
      imageUrl: channelAvatar,
      subscribersCount: creator.subscribersCount || 0
    }
  }));

  const aboutData = creator.about ?? { bannerImageUrl: null, links: [], contactEmail: null, joinedAt: '', totalViews: allVideos.reduce((sum, v) => sum + (v.views ?? 0), 0) };
  const bannerUrl = aboutData.bannerImageUrl;
  const displayName = creator.name;
  const displayBio = creator.bio || (tx("Witamy na oficjalnym kanale.", "Welcome to the official channel."));

  return (
    <div className="channel-page-shell min-h-screen bg-[var(--chan-nav)] text-[var(--chan-ink)] font-sans">
      <Navbar />

      <main id="main" tabIndex={-1} className="max-w-[1284px] mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-6 md:pt-8 focus:outline-none">
        {bannerUrl && (
          // Fixed 4:1 picture; on narrow screens a taller 3:1 crop (object-cover) keeps the centre visible.
          <div className="channel-banner mb-5 aspect-[3/1] w-full overflow-hidden rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-surface)] sm:aspect-[4/1]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerUrl} alt="" width={1280} height={320} className="h-full w-full object-cover" decoding="async" />
          </div>
        )}
        <header className="channel-profile flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:gap-8 md:text-left">
          <div className="channel-profile-avatar w-28 h-28 md:w-40 md:h-40 rounded-full border border-[var(--chan-line)] shrink-0">
             <SafeAvatar
               src={channelAvatar}
               alt={displayName}
               size={112}
               className="md:hidden bg-[var(--chan-avatar-gradient)]"
             />
             <SafeAvatar
               src={channelAvatar}
               alt={displayName}
               size={160}
               className="hidden md:block bg-[var(--chan-avatar-gradient)]"
             />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-brand text-[32px] md:text-[46px] font-bold leading-[1.05] tracking-[-0.04em] break-words">
              {displayName}
            </h1>
            <ul className="mt-3 flex flex-wrap justify-center md:justify-start gap-2 text-[13px] font-sans" aria-label={tx("Informacje o kanale", "Channel details")}>
               <li className="channel-profile-chip font-bold text-[var(--chan-ink)]">@{creator.handle ?? creator.slug}</li>
               <li className="channel-profile-chip text-[var(--chan-muted)]">{formatCount(allVideos.length)} {countedNoun(locale, "videos", allVideos.length)}</li>
            </ul>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--chan-body)] max-w-2xl mx-auto md:mx-0 font-sans whitespace-pre-line">
               {displayBio}
            </p>
          </div>
          <div className="shrink-0 md:self-center">
            <SubscribeButton
              creatorId={creator.id}
              creatorSlug={creator.slug}
              creatorName={creator.name}
              initialIsSubscribed={Boolean(initialSubscription)}
              initialNotify={initialSubscription?.notify ?? true}
            />
            <ReportButton targetType="CHANNEL" targetId={creator.id} className="mt-3" />
          </div>
        </header>

        <ChannelTabs
          ariaLabel={tx("Sekcje kanału", "Channel sections")}
          labels={{ videos: tx("Wideo", "Videos"), about: tx("O kanale", "About") }}
          videos={(
            <>
        {allVideos.length > 0 ? (
          <div className="channel-video-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8 py-7">
            {allVideos.map((video, index) => (
              <ChannelVideoCard
                key={video.id}
                video={video}
                isLoggedIn={!!userId}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center space-y-4">
             <div className="text-4xl opacity-20">🎬</div>
             <h3 className="font-brand text-xl font-bold uppercase tracking-tight text-[var(--chan-ink)]">{tx("Brak publicznych materiałów", "No public videos")}</h3>
             <p className="text-[var(--chan-muted)] max-w-md mx-auto">{tx("Na kanale nie ma jeszcze opublikowanych materiałów. Wróć tu później.", "This channel has no published videos yet. Check back later.")}</p>
             <Link href={getLocalizedHref(locale, "home")} className="inline-block mt-4 text-[14px] font-bold uppercase tracking-widest border-b-2 border-[var(--chan-ink)] pb-1 hover:opacity-70 transition-opacity">
                {tx("Przejdź do strony głównej", "Go to home")}
             </Link>
          </div>
        )}
            <ChannelPlaylistsSection channelId={creator.id} channelSlug={creator.slug} locale={locale} signedIn={!!userId} />
            </>
          )}
          about={(
            <ChannelAbout
              tx={tx}
              locale={locale}
              description={displayBio}
              about={aboutData}
              subscribersCount={creator.subscribersCount || 0}
              videoCount={allVideos.length}
            />
          )}
        />
      </main>
      <Footer />
    </div>
  );
}
