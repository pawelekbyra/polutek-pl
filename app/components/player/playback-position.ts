/**
 * The current playback position of the video on screen, shared between the player (writes it on every
 * time update, no re-render) and the share menu ("Start at current time", reads it when the menu opens).
 * A plain module value on purpose: it changes several times a second and nothing renders from it.
 */
let current: { videoId: string; seconds: number } | null = null;

export function setPlaybackPosition(videoId: string, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  current = { videoId, seconds };
}

/** Whole seconds of the given video's position, or null when the player has not reported it. */
export function getPlaybackPosition(videoId: string): number | null {
  if (!current || current.videoId !== videoId) return null;
  return Math.floor(current.seconds);
}

export function clearPlaybackPosition(videoId: string): void {
  if (current?.videoId === videoId) current = null;
}
