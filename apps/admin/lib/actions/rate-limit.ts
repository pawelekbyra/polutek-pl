/**
 * In-process sliding-window limiter for panel writes. The panel is one small container for one owner, so a
 * per-process counter is enough (a restart resets it, which is harmless here); it exists to stop a stuck
 * client loop or a stolen session from hammering destructive actions, not to meter traffic.
 */
type Hit = number[];
const windows = new Map<string, Hit>();

export type LimitRule = { bucket: string; max: number; windowMs: number };

export function checkRateLimit(actor: string, rule: LimitRule, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const key = `${actor}:${rule.bucket}`;
  const recent = (windows.get(key) ?? []).filter((t) => now - t < rule.windowMs);
  if (recent.length >= rule.max) {
    windows.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000)) };
  }
  recent.push(now);
  windows.set(key, recent);
  // Keep the map small: drop keys whose newest hit left the window.
  if (windows.size > 500) for (const [k, hits] of windows) if (!hits.length || now - hits[hits.length - 1] >= rule.windowMs) windows.delete(k);
  return { ok: true };
}

export function resetRateLimits(): void {
  windows.clear();
}
