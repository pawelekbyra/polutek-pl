export function getViewThresholdMs(durationSeconds?: number): number {
    const durationMs = Number.isFinite(durationSeconds) && durationSeconds && durationSeconds > 0
        ? durationSeconds * 1000
        : null;

    return durationMs ? Math.min(10000, durationMs * 0.9) : 10000;
}

export function shouldSendViewForPlaybackPosition(currentTimeSeconds: number, durationSeconds?: number): boolean {
    if (!Number.isFinite(currentTimeSeconds) || currentTimeSeconds < 0) return false;
    return currentTimeSeconds * 1000 >= getViewThresholdMs(durationSeconds);
}
