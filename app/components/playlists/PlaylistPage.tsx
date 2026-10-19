import React from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { getLocalizedHref, appendQueryString, type Locale } from "@/lib/i18n/routing";
import { getServerTx } from "@/lib/i18n/server-tx";
import { countedNoun } from "@/lib/i18n/plurals";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { buildWatchQuery, type PlaylistVideoCardDto, type PublicPlaylistDto } from "@/lib/modules/playlists";

/**
 * The public page of a playlist (`/playlista/<channel>/<slug>`, `/en/playlist/<channel>/<slug>`): title, description,
 * a link to the channel, "Play all" and the ordered cards of the videos the viewer may see. The cards link to the
 * watch page with the playlist context (`?v=<video>&list=<playlist>&i=<n>`).
 */

export async function PlaylistNotFound({ locale }: { locale: Locale }) {
  const tx = await getServerTx(locale);
  return (
    <div className="min-h-screen flex flex-col bg-[var(--chan-nav)] text-[var(--chan-ink)] font-sans">
      <Navbar />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col items-center justify-center p-4 text-center focus:outline-none">
        <h1 className="font-brand text-3xl font-bold md:text-4xl">{tx("Playlista niedostępna", "Playlist unavailable")}</h1>
        <p className="mb-6 mt-2 max-w-md text-[var(--chan-muted)]">{tx("Ta playlista nie istnieje albo jest prywatna.", "This playlist does not exist or is private.")}</p>
        <Link
          href={getLocalizedHref(locale, "home")}
          className="rounded-xl bg-[var(--chan-ink)] px-8 py-3 font-brand font-bold tracking-wide text-white transition-all hover:opacity-90"
        >
          {tx("Wróć na stronę główną", "Back home")}
        </Link>
      </main>
      <Footer />
    </div>
  );
}

function watchHref(locale: Locale, playlistSlug: string, video: PlaylistVideoCardDto, oneBasedIndex: number): string {
  return appendQueryString(getLocalizedHref(locale, "home"), buildWatchQuery(video.slug, playlistSlug, oneBasedIndex));
}

export default async function PlaylistPage({ locale, playlist, signedIn }: { locale: Locale; playlist: PublicPlaylistDto; signedIn: boolean }) {
  const tx = await getServerTx(locale);
  const first = playlist.items[0];
  const count = playlist.items.length;

  return (
    <div className="min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
      <Navbar />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1284px] px-4 pb-10 pt-4 focus:outline-none md:px-6 md:pt-8 lg:px-8">
        <header className="rounded-[24px] border border-[var(--chan-line)] bg-[var(--chan-card)] p-5 md:p-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--chan-muted)]">{tx("Playlista", "Playlist")}</p>
          <h1 className="mt-1 break-words font-brand text-[28px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[40px]">{playlist.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[var(--chan-muted)]">
            <Link
              href={getLocalizedHref(locale, "channel", { slug: playlist.channel.slug })}
              className="font-semibold text-[var(--chan-ink)] underline-offset-4 hover:underline"
            >
              {tx("Kanał: {0}", "Channel: {0}", playlist.channel.name)}
            </Link>
            <span aria-hidden="true">{"•"}</span>
            <span>
              {count} {countedNoun(locale, "videos", count)}
            </span>
          </p>
          {playlist.description && <p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-[var(--chan-body)]">{playlist.description}</p>}
          {first && (
            <div className="mt-5">
              <Link
                href={watchHref(locale, playlist.slug, first, 1)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--chan-ink)] px-6 py-2 text-[14px] font-bold text-[var(--chan-card)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] focus-visible:ring-offset-2"
              >
                {tx("Odtwórz wszystko", "Play all")}
              </Link>
            </div>
          )}
        </header>

        {count > 0 ? (
          <ol aria-label={tx("Filmy z playlisty", "Videos in this playlist")} className="grid grid-cols-1 gap-x-5 gap-y-7 py-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {playlist.items.map((video, index) => {
              const title = getVideoDisplayTitle(video, locale);
              const locked = video.tier !== "PUBLIC" && !signedIn;
              return (
                <li key={video.id} className="group relative">
                  <Link href={watchHref(locale, playlist.slug, video, index + 1)} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] focus-visible:ring-offset-2 rounded-[14px]">
                    <div className="relative mb-3 aspect-video overflow-hidden rounded-[14px] bg-black">
                      {video.thumbnailUrl ? (
                        <Image
                          src={video.thumbnailUrl}
                          alt=""
                          fill
                          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover opacity-90 transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
                        />
                      ) : null}
                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">{index + 1}</span>
                      {video.isAdult && <span className="absolute left-2 top-9 rounded-full bg-red-600 px-2 py-[3px] text-[9px] font-black leading-none tracking-[0.1em] text-white">18+</span>}
                      {locked && (
                        <span className="absolute right-2 top-2 rounded-full bg-[var(--chan-ink)] px-2 py-[3px] text-[9px] font-black uppercase leading-none tracking-[0.14em] text-white">
                          {tx("Logowanie", "Login")}
                        </span>
                      )}
                      {video.duration && <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[12px] font-bold text-white">{video.duration}</span>}
                    </div>
                    <h2 className="line-clamp-2 text-[14px] font-bold uppercase leading-tight tracking-[0.01em] text-[var(--chan-ink)]">{title}</h2>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="py-16 text-center text-[var(--chan-muted)]">
            {tx("Na tej playliście nie ma teraz filmów, które możesz obejrzeć.", "There are no videos on this playlist that you can watch right now.")}
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
