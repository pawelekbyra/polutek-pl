import type { PlaylistQueueDto } from "@/lib/modules/playlists/domain/playlist.dto";
import { buildWatchQuery } from "@/lib/modules/playlists/domain/playlist-queue";

/**
 * What the watch page does when a video is picked while a playlist is open. Pure, so the rules are testable:
 *  - a video of the open playlist keeps the playlist context in the address (`?v=&list=&i=`);
 *  - any other video picked in the sidebar leaves the playlist (`leaveQueue`) and the address is the plain `?v=`;
 *  - a queue entry that is not in the home list cannot be switched in place (`inPlace: false`): it opens by address.
 */

export type VideoSwitchPlan = { query: string; leaveQueue: boolean };

export function planSidebarSwitch(queue: PlaylistQueueDto | null, clickedId: string, clickedSlug: string | undefined): VideoSwitchPlan {
  const index = queue ? queue.items.findIndex((item) => item.id === clickedId) : -1;
  if (queue && index >= 0) {
    return { query: buildWatchQuery(clickedSlug || queue.items[index]!.slug, queue.slug, index + 1), leaveQueue: false };
  }
  return { query: `v=${encodeURIComponent(clickedSlug || clickedId)}`, leaveQueue: queue !== null };
}

export type QueueSelectPlan = { videoId: string; query: string; inPlace: boolean };

export function planQueueSelect(queue: PlaylistQueueDto | null, index: number, knownVideoIds: readonly string[]): QueueSelectPlan | null {
  const item = queue?.items[index];
  if (!queue || !item) return null;
  return { videoId: item.id, query: buildWatchQuery(item.slug, queue.slug, index + 1), inPlace: knownVideoIds.includes(item.id) };
}
