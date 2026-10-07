/**
 * Live probes of our own services (never third-party APIs): the public app's /api/health over the
 * internal Docker network, the Redis REST gateway and the HLS Worker. Each probe has a hard timeout
 * and the results are cached in the process (stale-while-revalidate, 60 s): a screen renders from the
 * last known result at once and refreshes it in the background, so a slow probe never delays a page
 * by more than its first-ever timeout.
 */
export type ProbeResult = { ok: boolean; latencyMs: number | null; detail: string; measuredAt: string };

type Fetcher = typeof fetch;

const PROBE_TIMEOUT_MS = 1500;
const FRESH_MS = 60_000;

async function timed(run: (signal: AbortSignal) => Promise<{ ok: boolean; detail: string }>): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const r = await run(controller.signal);
    return { ...r, latencyMs: Date.now() - started, measuredAt: new Date().toISOString() };
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      latencyMs: aborted ? null : Date.now() - started,
      detail: aborted ? `brak odpowiedzi w ${PROBE_TIMEOUT_MS / 1000} s` : `błąd połączenia (${error instanceof Error ? error.name : "nieznany"})`,
      measuredAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Public site, from inside the Docker network (default http://app:3000). */
export function probePublicApp(baseUrl: string, fetcher: Fetcher = fetch): Promise<ProbeResult> {
  return timed(async (signal) => {
    const res = await fetcher(`${baseUrl.replace(/\/+$/, "")}/api/health`, { signal, cache: "no-store" });
    return { ok: res.status < 500, detail: `HTTP ${res.status}` };
  });
}

/**
 * Redis through the REST gateway (srh): a PING command sent as POST ["PING"] with the bearer token, expects PONG.
 * (srh has no GET /ping route and answers 404 there; the command form works on srh and on Upstash alike.)
 */
export function probeRedis(url: string, token: string, fetcher: Fetcher = fetch): Promise<ProbeResult> {
  return timed(async (signal) => {
    const res = await fetcher(url.replace(/\/+$/, ""), {
      method: "POST",
      signal,
      cache: "no-store",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(["PING"]),
    });
    const body = (await res.json().catch(() => null)) as { result?: unknown } | null;
    const pong = res.ok && body?.result === "PONG";
    return { ok: pong, detail: pong ? "PONG" : `HTTP ${res.status}` };
  });
}

/**
 * HLS Worker on video.pawelperfect.com: a HEAD on the root is answered by the Worker itself with 404
 * (no such video path) in a few ms. Any non-5xx answer means the Worker runs; this costs one request
 * of the daily Workers limit per minute at most (cache), and never touches a video.
 */
export function probeHlsWorker(baseUrl: string, fetcher: Fetcher = fetch): Promise<ProbeResult> {
  return timed(async (signal) => {
    const res = await fetcher(`${baseUrl.replace(/\/+$/, "")}/`, { method: "HEAD", signal, cache: "no-store", redirect: "manual" });
    return { ok: res.status < 500, detail: `HTTP ${res.status}` };
  });
}

type Entry = { value: ProbeResult; at: number; pending: Promise<ProbeResult> | null };
const cache = new Map<string, Entry>();

/** Stale-while-revalidate around a probe. Exported for tests (`clearProbeCache`). */
export async function cachedProbe(key: string, run: () => Promise<ProbeResult>, now: number = Date.now()): Promise<ProbeResult> {
  const entry = cache.get(key);
  if (entry && now - entry.at < FRESH_MS) return entry.value;
  if (entry) {
    if (!entry.pending) {
      entry.pending = run()
        .then((value) => {
          cache.set(key, { value, at: Date.now(), pending: null });
          return value;
        })
        .catch(() => {
          entry.pending = null;
          return entry.value;
        });
    }
    return entry.value;
  }
  const value = await run();
  cache.set(key, { value, at: Date.now(), pending: null });
  return value;
}

export function clearProbeCache() {
  cache.clear();
}
