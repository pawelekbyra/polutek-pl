/**
 * Tiny in-process stale-while-revalidate cache (docs/architecture/admin-panel.md "Odświeżanie"): a fresh entry is
 * returned as is, a stale one is returned immediately while ONE background refresh runs, and a failed refresh keeps
 * the stale value. Bounded: at most `maxEntries` keys (oldest dropped), so a long-running panel never grows.
 */
export type SwrCache = {
  get<T>(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
  size(): number;
};

export function createSwrCache(opts: { freshMs: number; staleMs: number; maxEntries?: number; now?: () => number }): SwrCache {
  const max = opts.maxEntries ?? 64;
  const clock = opts.now ?? Date.now;
  const store = new Map<string, { at: number; value: unknown; refreshing: boolean }>();
  const inflight = new Map<string, Promise<unknown>>();

  function put(key: string, value: unknown) {
    store.delete(key);
    store.set(key, { at: clock(), value, refreshing: false });
    while (store.size > max) store.delete(store.keys().next().value as string);
  }

  return {
    async get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const hit = store.get(key);
      const age = hit ? clock() - hit.at : Infinity;
      if (hit && age < opts.freshMs) return hit.value as T;
      if (hit && age < opts.staleMs) {
        if (!hit.refreshing) {
          hit.refreshing = true;
          void load().then((v) => put(key, v), () => { hit.refreshing = false; });
        }
        return hit.value as T;
      }
      // Cold or too old: callers asking at the same time share one load.
      let p = inflight.get(key) as Promise<T> | undefined;
      if (!p) {
        p = load().then(
          (v) => { put(key, v); inflight.delete(key); return v; },
          (e) => { inflight.delete(key); throw e; },
        );
        inflight.set(key, p);
      }
      return p;
    },
    clear() { store.clear(); inflight.clear(); },
    size: () => store.size,
  };
}
