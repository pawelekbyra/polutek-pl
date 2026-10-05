import { createLiveHub, getLiveSnapshot, resolveLiveTarget, type LiveHub, type LiveSnapshot } from "@/lib/modules/admin-analytics";
import { analyticsDeps } from "./analytics";

/** One shared poller per watched film (or the whole channel), at most this many at a time and per hub. */
export const LIVE_INTERVAL_MS = 3_000;
export const MAX_HUBS = 3;
export const MAX_SUBSCRIBERS_PER_HUB = 4;

const hubs = new Map<string, LiveHub<LiveSnapshot>>();

/** Hub for a film key ("" = what the live mode picks by itself). Returns null when too many hubs exist. */
export function liveHubFor(key: string): LiveHub<LiveSnapshot> | null {
  const existing = hubs.get(key);
  if (existing) return existing;
  // Forget hubs without listeners before counting, so a stale key never blocks a new one.
  for (const [k, h] of hubs) if (h.subscribers() === 0) hubs.delete(k);
  if (hubs.size >= MAX_HUBS) return null;
  const hub = createLiveHub<LiveSnapshot>({
    intervalMs: LIVE_INTERVAL_MS,
    maxSubscribers: MAX_SUBSCRIBERS_PER_HUB,
    poll: async () => {
      const deps = analyticsDeps();
      const target = await resolveLiveTarget(deps, key || null);
      return getLiveSnapshot(deps, { video: target.video, since: target.since });
    },
  });
  hubs.set(key, hub);
  return hub;
}
