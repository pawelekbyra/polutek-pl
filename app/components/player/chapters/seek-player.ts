import type { MediaPlayerInstance } from "@vidstack/react";
import { clampStartTime } from "@/lib/video-start-time";

/**
 * Jumps the player to a time. The same safe jump as the `?t=` start: past the end it lands one second before it.
 * A video that had ended plays again from there (a seek alone would leave it on the replay screen).
 */
export function seekPlayerTo(player: MediaPlayerInstance, seconds: number): void {
  const wasEnded = player.state.ended;
  player.currentTime = clampStartTime(seconds, player.duration);
  if (wasEnded) void player.play().catch(() => undefined);
}
