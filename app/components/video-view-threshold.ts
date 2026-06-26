export const VIEW_COUNT_THRESHOLD_MS = 10_000;

export function getViewThresholdMs(): number {
  return VIEW_COUNT_THRESHOLD_MS;
}

export function shouldSendViewForPlaybackPosition(positionMs: number): boolean {
  return positionMs >= getViewThresholdMs();
}
