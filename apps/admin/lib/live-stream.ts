/**
 * Server-Sent Events stream for the live premiere mode (docs/architecture/admin-phaseA.md, "SSE").
 *  - a `snapshot` event whenever the shared hub has a new value (every few seconds), and one immediately on connect;
 *  - an SSE comment (`: keep-alive`) every 25 s regardless: Cloudflare closes a connection that is silent for ~100 s
 *    (error 524), so the stream is never idle that long;
 *  - backpressure: when the consumer is slow (the queue is full) a snapshot is dropped, never queued without bound
 *    (a newer one follows in seconds); memory per connection is one small queue;
 *  - the stream ends by itself after `maxLifetimeMs` (the browser's EventSource reconnects, which also re-checks the
 *    session), and on abort/cancel every timer and subscription is released.
 * Pure Web Streams API: no Next.js, testable with fake timers.
 */
import type { LiveHub } from "@/lib/modules/admin-analytics";

export const KEEP_ALIVE_MS = 25_000;
export const MAX_LIFETIME_MS = 30 * 60_000;
export const RETRY_MS = 5_000;

export type LiveStreamOptions<T> = {
  hub: LiveHub<T>;
  signal?: AbortSignal;
  keepAliveMs?: number;
  maxLifetimeMs?: number;
  /** Chunks the queue may hold before snapshots are dropped. */
  queueSize?: number;
  onClose?: () => void;
};

const encoder = new TextEncoder();

export const sseEvent = (name: string, data: unknown): string => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
export const SSE_KEEP_ALIVE = ": keep-alive\n\n";

/** Returns null when the hub is full (the route answers 503 then). */
export function createLiveStream<T>(opts: LiveStreamOptions<T>): ReadableStream<Uint8Array> | null {
  if (opts.hub.full()) return null;
  let cleanup: () => void = () => undefined;
  let unsub: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let closed = false;
        let keep: ReturnType<typeof setInterval> | null = null;
        let life: ReturnType<typeof setTimeout> | null = null;
        const close = () => {
          if (closed) return;
          closed = true;
          if (keep) clearInterval(keep);
          if (life) clearTimeout(life);
          unsub?.();
          opts.signal?.removeEventListener("abort", close);
          try {
            controller.close();
          } catch {
            // already closed by the consumer
          }
          opts.onClose?.();
        };
        cleanup = close;
        const push = (text: string, droppable: boolean) => {
          if (closed) return;
          // desiredSize <= 0: the queue is full, the client reads slowly. Skip droppable data instead of growing.
          if (droppable && (controller.desiredSize ?? 1) <= 0) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            close();
          }
        };
        push(`retry: ${RETRY_MS}\n\n`, false);
        unsub = opts.hub.subscribe(
          (value) => push(sseEvent("snapshot", value), true),
          () => push(sseEvent("problem", { message: "Odczyt danych na żywo nie powiódł się, ponawiam." }), true),
        );
        if (!unsub) {
          closed = true;
          controller.close();
          return;
        }
        keep = setInterval(() => push(SSE_KEEP_ALIVE, false), opts.keepAliveMs ?? KEEP_ALIVE_MS);
        life = setTimeout(close, opts.maxLifetimeMs ?? MAX_LIFETIME_MS);
        if (opts.signal?.aborted) close();
        else opts.signal?.addEventListener("abort", close, { once: true });
      },
      cancel() {
        cleanup();
      },
    },
    { highWaterMark: opts.queueSize ?? 4, size: () => 1 },
  );
  return stream;
}
