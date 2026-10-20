/**
 * A request to jump the video on screen to a time, from outside the player (the clickable times in the description,
 * the chapter list under it). The player's ChaptersSeekListener does the jump. A window event on purpose: the card
 * under the video is a sibling of the player, not a child, and the jump has to go through the player's own
 * `currentTime` (the address' `?t=` is read once per page load, so it cannot be used for it; docs/architecture/video-chapters.md §5).
 */
export const SEEK_REQUEST_EVENT = "polutek:seek-request";

export type SeekRequestDetail = { videoId: string; seconds: number };

export function requestSeek(videoId: string, seconds: number): void {
  if (typeof window === "undefined" || !Number.isFinite(seconds) || seconds < 0) return;
  try {
    window.dispatchEvent(new CustomEvent<SeekRequestDetail>(SEEK_REQUEST_EVENT, { detail: { videoId, seconds } }));
  } catch {
    // A jump is a convenience; never let it break the page.
  }
}
