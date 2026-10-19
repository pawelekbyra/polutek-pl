import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import { getServerTx } from "@/lib/i18n/server-tx";
import { countedNoun } from "@/lib/i18n/plurals";
import { listPublicPlaylistsForChannel } from "@/lib/modules/playlists";

/**
 * The "Playlists" shelf of a channel page: the channel's PUBLIC playlists that have at least one video the viewer
 * sees (UNLISTED and PRIVATE ones are never listed, empty ones are skipped). Renders nothing when there is none, so
 * the channel page can mount it unconditionally:
 *
 *   <ChannelPlaylistsSection channelId={creator.id} channelSlug={creator.slug} locale={locale} signedIn={!!userId} />
 *
 * Server component: it reads the data itself, the host page passes only who and where (docs/architecture/playlists.md).
 */
export default async function ChannelPlaylistsSection({
  channelId,
  channelSlug,
  locale,
  signedIn,
}: {
  channelId: string;
  channelSlug: string;
  locale: Locale;
  signedIn: boolean;
}) {
  const playlists = await listPublicPlaylistsForChannel({ channelId, channelSlug, signedIn }).catch(() => []);
  if (playlists.length === 0) return null;
  const tx = await getServerTx(locale);

  return (
    <section aria-labelledby="channel-playlists-heading" className="py-7">
      <h2 id="channel-playlists-heading" className="mb-4 font-brand text-[20px] font-bold tracking-[-0.02em] text-[var(--chan-ink)]">
        {tx("Playlisty", "Playlists")}
      </h2>
      <ul className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {playlists.map((playlist) => (
          <li key={playlist.id} className="group">
            <Link
              href={getLocalizedHref(locale, "playlist", { channel: playlist.channelSlug, slug: playlist.slug })}
              className="block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] focus-visible:ring-offset-2"
            >
              <div className="relative mb-3 aspect-video overflow-hidden rounded-[14px] bg-neutral-900">
                {playlist.coverThumbnailUrl && (
                  <Image
                    src={playlist.coverThumbnailUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 20vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover opacity-90 transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
                  />
                )}
                <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[12px] font-bold text-white">
                  {playlist.itemCount} {countedNoun(locale, "videos", playlist.itemCount)}
                </span>
              </div>
              <h3 className="line-clamp-2 text-[14px] font-bold uppercase leading-tight tracking-[0.01em] text-[var(--chan-ink)]">{playlist.title}</h3>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
