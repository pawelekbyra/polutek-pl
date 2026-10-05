/**
 * One shared poller per key (a film or the whole channel) for the SSE stream. It starts with the first subscriber,
 * polls every `intervalMs` (never two polls at once) and stops with the last subscriber, so database load does not
 * depend on how many browsers are open and an idle panel does nothing. Bounded: at most `maxSubscribers` listeners.
 */
export type LiveHub<T> = {
  /** Registers a listener; returns an unsubscribe function, or null when the hub is full. */
  subscribe(listener: (value: T) => void, onError?: (error: unknown) => void): (() => void) | null;
  /** Last successful value, if any. */
  latest(): T | null;
  subscribers(): number;
  /** True when no further listener is accepted. */
  full(): boolean;
};

export function createLiveHub<T>(opts: {
  poll: () => Promise<T>;
  intervalMs: number;
  maxSubscribers: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}): LiveHub<T> {
  const setT = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const listeners = new Map<symbol, { ok: (v: T) => void; err?: (e: unknown) => void }>();
  let timer: unknown = null;
  let running = false;
  let last: T | null = null;

  async function tick() {
    timer = null;
    if (listeners.size === 0) return;
    running = true;
    try {
      const value = await opts.poll();
      last = value;
      for (const l of [...listeners.values()]) l.ok(value);
    } catch (error) {
      for (const l of [...listeners.values()]) l.err?.(error);
    } finally {
      running = false;
      if (listeners.size > 0 && timer === null) timer = setT(() => void tick(), opts.intervalMs);
    }
  }

  return {
    subscribe(ok, err) {
      if (listeners.size >= opts.maxSubscribers) return null;
      const id = Symbol("listener");
      listeners.set(id, { ok, err });
      if (last) ok(last);
      if (!running && timer === null) void tick();
      return () => {
        listeners.delete(id);
        if (listeners.size === 0) {
          if (timer !== null) clearT(timer);
          timer = null;
          last = null;
        }
      };
    },
    latest: () => last,
    subscribers: () => listeners.size,
    full: () => listeners.size >= opts.maxSubscribers,
  };
}
