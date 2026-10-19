import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { getBaseUrl } from "@/lib/utils";
import { SITE_TITLE } from "@/lib/constants";
import { getLocaleAlternates, isLocale, type Locale } from "@/lib/i18n/routing";
import { getPublicPlaylist, shouldNoIndexPlaylist } from "@/lib/modules/playlists";
import PlaylistPage, { PlaylistNotFound } from "./PlaylistPage";

/**
 * Shared by the two route folders (`playlista` for Polish, `playlist` for the other languages, like regulamin/terms):
 * both resolve the same data, so a playlist link works in every language prefix.
 */

export type PlaylistRouteProps = { params: Promise<{ locale: string; channel: string; slug: string }> };

async function viewerIsSignedIn(): Promise<boolean> {
  try {
    return Boolean((await auth()).userId);
  } catch {
    return false;
  }
}

// One lookup per request, shared by the metadata and the page.
const loadPlaylist = cache(async (channel: string, slug: string, signedIn: boolean) =>
  getPublicPlaylist({ channelKey: decodeURIComponent(channel), playlistSlug: decodeURIComponent(slug).toLowerCase(), signedIn }),
);

export async function generatePlaylistMetadata(props: PlaylistRouteProps): Promise<Metadata> {
  const { locale: rawLocale, channel, slug } = await props.params;
  if (!isLocale(rawLocale)) return { title: SITE_TITLE };
  const playlist = await loadPlaylist(channel, slug, await viewerIsSignedIn()).catch(() => null);
  if (!playlist) return { title: SITE_TITLE, robots: { index: false, follow: false } };
  return {
    // Browser tab always reads the site address (CLAUDE.md 4.13); the playlist title is kept for social previews.
    title: SITE_TITLE,
    description: playlist.description ?? playlist.title,
    // An UNLISTED playlist (link only) must never be indexed.
    ...(shouldNoIndexPlaylist(playlist.visibility) ? { robots: { index: false, follow: false, nocache: true } } : {}),
    alternates: getLocaleAlternates(rawLocale, "playlist", { params: { channel: playlist.channel.slug, slug: playlist.slug }, baseUrl: getBaseUrl() }),
    openGraph: { title: playlist.title, description: playlist.description ?? undefined, type: "website" },
    twitter: { card: "summary", title: playlist.title },
  };
}

export async function renderPlaylistRoute(props: PlaylistRouteProps) {
  const { locale: rawLocale, channel, slug } = await props.params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const signedIn = await viewerIsSignedIn();
  const playlist = await loadPlaylist(channel, slug, signedIn).catch(() => null);
  if (!playlist) return <PlaylistNotFound locale={locale} />;
  return <PlaylistPage locale={locale} playlist={playlist} signedIn={signedIn} />;
}
