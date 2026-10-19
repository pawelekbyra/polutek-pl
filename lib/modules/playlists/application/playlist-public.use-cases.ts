import { isPlaylistServedPublicly } from "../domain/playlist-visibility";
import type { PlaylistQueueDto, PublicPlaylistDto, PublicPlaylistSummaryDto } from "../domain/playlist.dto";
import { locateInQueue } from "../domain/playlist-queue";
import type { PlaylistVisibilityValue } from "../domain/playlist-rules";
import { loadPublicPlaylist, loadPublicPlaylistSummaries, loadQueue, loadVideoChannel } from "../infrastructure/public-playlist.repository";

/**
 * Public reads of playlists (no actor; whitelisted DTOs). A PRIVATE, deleted or unknown playlist, a hidden channel
 * and a wrong channel/slug pair are all just "not found". Items the viewer may not see are skipped without a trace.
 */

export async function getPublicPlaylist(input: {
  channelKey: string;
  playlistSlug: string;
  signedIn: boolean;
  now?: Date;
}): Promise<PublicPlaylistDto | null> {
  const loaded = await loadPublicPlaylist(input.channelKey, input.playlistSlug, input.signedIn, input.now ?? new Date());
  if (!loaded) return null;
  const { channel, playlist, items } = loaded;
  if (!isPlaylistServedPublicly({ visibility: playlist.visibility }, channel)) return null;
  return {
    id: playlist.id,
    slug: playlist.slug,
    title: playlist.title,
    description: playlist.description,
    visibility: playlist.visibility as PlaylistVisibilityValue,
    channel: { id: channel.id, name: channel.name, slug: channel.slug, handle: channel.handle },
    items,
  };
}

/**
 * The PUBLIC playlists of a channel that have at least one video the viewer sees (an empty shelf is not shown).
 * The channel page mounts this through `ChannelPlaylistsSection`.
 */
export async function listPublicPlaylistsForChannel(input: {
  channelId: string;
  channelSlug: string;
  signedIn: boolean;
  now?: Date;
}): Promise<PublicPlaylistSummaryDto[]> {
  const rows = await loadPublicPlaylistSummaries(input.channelId, input.signedIn, input.now ?? new Date());
  return rows
    .filter((row) => row.visible.length > 0)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      itemCount: row.visible.length,
      coverThumbnailUrl: row.visible[0]?.thumbnailUrl ?? null,
      channelSlug: input.channelSlug,
    }));
}

/**
 * The queue of the watch page for `?list=<slug>`: the playlist must belong to the open video's own channel, be PUBLIC
 * or UNLISTED, and the open video must be one of the items the viewer sees (otherwise there is no queue and the
 * page behaves as if `?list=` was absent: nothing leaks about a hidden or private list).
 */
export async function getPlaylistQueue(input: {
  videoId: string;
  listSlug: string;
  signedIn: boolean;
  now?: Date;
}): Promise<PlaylistQueueDto | null> {
  const channel = await loadVideoChannel(input.videoId);
  if (!channel) return null;
  const loaded = await loadQueue(channel.id, input.listSlug, input.signedIn, input.now ?? new Date());
  if (!loaded) return null;
  if (!isPlaylistServedPublicly({ visibility: "PUBLIC" }, channel)) return null;
  const position = locateInQueue(
    loaded.items.map((item) => item.id),
    input.videoId,
  );
  if (position.index < 0) return null;
  return { slug: loaded.playlist.slug, title: loaded.playlist.title, channelSlug: channel.slug, index: position.index, items: loaded.items };
}
