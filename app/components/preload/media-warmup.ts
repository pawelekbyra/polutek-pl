/**
 * Warms the first seconds of a video the viewer is about to pick (hover, keyboard focus, touch),
 * so a click starts playback at once instead of waiting for the master playlist, the media
 * playlist, the init segment and the first segment one after another.
 *
 * How: a throw-away hls.js instance with the player's own config (same start-rung choice, same
 * player-size cap) loads exactly what the real player loads first and stops after the first
 * media segment. Delivery responses are cacheable (playlists `max-age=300`, segments
 * `immutable`), and the click reuses the cached plan and therefore the very same URLs, so the
 * player's requests are answered from the browser's HTTP cache.
 *
 * It only ever receives the delivery URL of a READY plan the server issued to this viewer (a
 * denied or premiere plan has none), calls no API of ours, opens no playback session and counts
 * no view. It is bounded: a short dwell before starting (a tap that becomes a click, or a pointer
 * that only passes over a tile, warms nothing), at most {@link MEDIA_WARMUP_MAX_ACTIVE} at once
 * (the oldest is cancelled), a timeout, one warm-up per stream, nothing on Data Saver or slow
 * networks, and touch only on a known fast connection (a phone that cannot say, e.g. iOS, is
 * spared: a scroll would otherwise spend mobile data).
 */
import { buildSelfHlsConfig, loadHlsLibrary } from '../player/self-hls';

export const MEDIA_WARMUP_MAX_ACTIVE = 2;
/** Dwell before a warm-up starts: a pointer passing over a tile or a quick tap warms nothing. */
export const MEDIA_WARMUP_DWELL_MS = 150;
export const MEDIA_WARMUP_TIMEOUT_MS = 15_000;

export type WarmupInput = 'mouse' | 'touch' | 'keyboard';

export type ConnectionLike = { saveData?: boolean; effectiveType?: string; downlink?: number };

/** Data Saver or a slow network: no speculative media download at all. */
export function isConstrainedConnection(connection: ConnectionLike | undefined): boolean {
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g';
}

export function mediaWarmupAllowed(input: WarmupInput, connection: ConnectionLike | undefined): boolean {
  if (isConstrainedConnection(connection)) return false;
  // Touch usually means a phone, maybe on mobile data: warm only on a connection known to be fast.
  if (input === 'touch') return connection?.effectiveType === '4g';
  return true;
}

/** The parts of hls.js this module uses (a fake in tests). */
type HlsInstanceLike = {
  on(event: string, listener: (event: string, data: unknown) => void): void;
  loadSource(url: string): void;
  attachMedia(media: HTMLMediaElement): void;
  startLoad(startPosition?: number): void;
  destroy(): void;
  levels: unknown[];
  autoLevelCapping: number;
};
type HlsDefaultConfigLike = Parameters<typeof buildSelfHlsConfig>[0]['defaults'] & {
  capLevelController?: { getMaxLevelByMediaSize?: (levels: never[], width: number, height: number) => number };
};
type HlsClassLike = {
  new (config: Record<string, unknown>): HlsInstanceLike;
  isSupported(): boolean;
  DefaultConfig: HlsDefaultConfigLike;
  Events: { MANIFEST_PARSED: string; FRAG_LOADED: string; ERROR: string };
};

/**
 * The rung cap hls.js's CapLevelController applies for a player of `size` (CSS px): its own
 * static helper with the same device-pixel scaling, so the warm-up and the player start on the
 * same rung. -1 = no cap (size unknown).
 */
export function capLevelForPlayerSize(
  Hls: HlsClassLike,
  levels: unknown[],
  size: { width: number; height: number } | null,
  devicePixelRatio: number,
): number {
  const helper = Hls.DefaultConfig.capLevelController?.getMaxLevelByMediaSize;
  if (!size || !helper || levels.length < 2) return -1;
  const config = Hls.DefaultConfig as HlsDefaultConfigLike & { ignoreDevicePixelRatio?: boolean; maxDevicePixelRatio?: number };
  const scale = config.ignoreDevicePixelRatio ? 1 : Math.min(devicePixelRatio || 1, config.maxDevicePixelRatio ?? Infinity);
  return helper(levels as never[], size.width * scale, size.height * scale);
}

export type MediaWarmupDeps = {
  loadHls?: () => Promise<{ default: HlsClassLike }>;
  connection?: () => ConnectionLike | undefined;
  /** Size of the player slot the click will play in (the cap rung depends on it). */
  playerSize?: () => { width: number; height: number } | null;
  createMediaElement?: () => HTMLVideoElement;
};

type Entry = {
  videoId: string;
  input: WarmupInput;
  state: 'pending' | 'running' | 'done';
  url?: string;
  dwellDone: boolean;
  dwellTimer?: ReturnType<typeof setTimeout>;
  timeout?: ReturnType<typeof setTimeout>;
  hls?: HlsInstanceLike;
  startedAt?: number;
};

function defaultConnection(): ConnectionLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: ConnectionLike }).connection;
}

function defaultPlayerSize(): { width: number; height: number } | null {
  if (typeof document === 'undefined') return null;
  const rect = document.querySelector('[data-player-slot]')?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? { width: rect.width, height: rect.height } : null;
}

export class MediaWarmup {
  private readonly entries = new Map<string, Entry>();
  private readonly warmedUrls = new Set<string>();
  private startCounter = 0;
  private disposed = false;
  private readonly deps: Required<MediaWarmupDeps>;

  constructor(deps: MediaWarmupDeps = {}) {
    this.deps = {
      loadHls: deps.loadHls ?? (loadHlsLibrary as unknown as () => Promise<{ default: HlsClassLike }>),
      connection: deps.connection ?? defaultConnection,
      playerSize: deps.playerSize ?? defaultPlayerSize,
      createMediaElement: deps.createMediaElement ?? (() => document.createElement('video')),
    };
  }

  /** The viewer shows interest in a video (pointer enter, focus). */
  intend(videoId: string, input: WarmupInput): void {
    if (this.disposed || this.entries.has(videoId)) return;
    if (!mediaWarmupAllowed(input, this.deps.connection())) return;
    const entry: Entry = { videoId, input, state: 'pending', dwellDone: false };
    entry.dwellTimer = setTimeout(() => {
      entry.dwellTimer = undefined;
      entry.dwellDone = true;
      this.tryStart(entry);
    }, MEDIA_WARMUP_DWELL_MS);
    this.entries.set(videoId, entry);
  }

  /** The delivery URL of the video's READY plan, once the plan is known. */
  provide(videoId: string, url: string): void {
    const entry = this.entries.get(videoId);
    if (!entry || entry.state !== 'pending' || entry.url) return;
    entry.url = url;
    this.tryStart(entry);
  }

  /** The interest ended before the warm-up started (pointer left, touch became a scroll). */
  release(videoId: string): void {
    const entry = this.entries.get(videoId);
    if (entry?.state === 'pending') this.remove(entry);
  }

  /**
   * The viewer picked `videoId`: the player now loads it, so nothing more is started and the
   * other videos' warm-ups stop competing for bandwidth. A running warm-up of the picked video
   * is left to finish: it fetches exactly what the player asks for next.
   */
  select(videoId: string): void {
    for (const entry of [...this.entries.values()]) {
      if (entry.state === 'pending' || (entry.state === 'running' && entry.videoId !== videoId)) {
        this.remove(entry);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of [...this.entries.values()]) this.remove(entry);
  }

  /** For tests and diagnostics. */
  activeCount(): number {
    return [...this.entries.values()].filter((entry) => entry.state === 'running').length;
  }

  private tryStart(entry: Entry): void {
    if (this.disposed || entry.state !== 'pending' || !entry.dwellDone || !entry.url) return;
    if (this.warmedUrls.has(entry.url)) {
      entry.state = 'done';
      return;
    }
    const running = [...this.entries.values()]
      .filter((other) => other.state === 'running')
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
    while (running.length >= MEDIA_WARMUP_MAX_ACTIVE) {
      const oldest = running.shift();
      if (oldest) this.remove(oldest);
    }
    entry.state = 'running';
    entry.startedAt = ++this.startCounter;
    void this.start(entry, entry.url);
  }

  private async start(entry: Entry, url: string): Promise<void> {
    let Hls: HlsClassLike;
    try {
      Hls = (await this.deps.loadHls()).default;
    } catch {
      this.finish(entry);
      return;
    }
    if (this.entries.get(entry.videoId) !== entry || entry.state !== 'running') return;
    if (!Hls.isSupported()) {
      this.finish(entry);
      return;
    }

    // A detached, muted media element: hls.js's start-rung choice needs one (without media it
    // assumes an unlimited buffer and picks the top rung, unlike the player). It never plays.
    const media = this.deps.createMediaElement();
    media.muted = true;
    (media as HTMLVideoElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
    const size = this.deps.playerSize();

    const hls = new Hls({
      ...buildSelfHlsConfig({
        defaults: Hls.DefaultConfig,
        currentMasterUrl: () => url,
        ensureFreshToken: () => Promise.resolve(),
        onAuthError: () => undefined,
        connection: this.deps.connection(),
      }),
      // The player's size cap is applied by hand below (a detached element has no size), then
      // loading starts; one segment is all we want, without a worker spin-up for it.
      capLevelToPlayerSize: false,
      autoStartLoad: false,
      maxBufferLength: 4,
      maxMaxBufferLength: 4,
      enableWorker: false,
    });
    entry.hls = hls;
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (entry.state !== 'running') return;
      const cap = capLevelForPlayerSize(Hls, hls.levels ?? [], size, typeof window === 'undefined' ? 1 : window.devicePixelRatio);
      if (cap >= 0) hls.autoLevelCapping = cap;
      hls.startLoad(-1);
    });
    hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      const sn = (data as { frag?: { sn?: unknown } } | undefined)?.frag?.sn;
      if (sn !== 'initSegment') this.finish(entry);
    });
    // Any error ends the warm-up (no retries: the player will do its own).
    hls.on(Hls.Events.ERROR, () => this.finish(entry));
    entry.timeout = setTimeout(() => this.finish(entry), MEDIA_WARMUP_TIMEOUT_MS);
    hls.attachMedia(media);
    hls.loadSource(url);
  }

  /** Warm-up over (done, failed or timed out): its stream is never warmed again. */
  private finish(entry: Entry): void {
    if (entry.state !== 'running') return;
    if (entry.url) this.warmedUrls.add(entry.url);
    entry.state = 'done';
    this.teardown(entry);
  }

  private remove(entry: Entry): void {
    if (this.entries.get(entry.videoId) === entry) this.entries.delete(entry.videoId);
    entry.state = 'done';
    this.teardown(entry);
  }

  private teardown(entry: Entry): void {
    if (entry.dwellTimer) clearTimeout(entry.dwellTimer);
    if (entry.timeout) clearTimeout(entry.timeout);
    entry.dwellTimer = undefined;
    entry.timeout = undefined;
    const hls = entry.hls;
    entry.hls = undefined;
    // Outside hls.js's own event dispatch: destroying from inside a listener is not safe.
    if (hls) setTimeout(() => hls.destroy(), 0);
  }
}
