/**
 * Window event the player fires when a video plays to its end (VideoPlayer onEnded). The watch page's playlist queue
 * listens for it to start the next video; nothing else depends on it, so the player stays unaware of playlists.
 */
export const VIDEO_ENDED_EVENT = "polutek:video-ended";

export type VideoEndedDetail = { videoId: string };

export function announceVideoEnded(videoId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent<VideoEndedDetail>(VIDEO_ENDED_EVENT, { detail: { videoId } }));
  } catch {
    // An event is a convenience (autoplay next); never let it break the player.
  }
}
