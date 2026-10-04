import { WATCHED_BUCKETS, WATCHED_HEX_LENGTH } from '@/lib/telemetry/beacon-constants';
import type { BeaconPlayback } from '@/lib/telemetry/beacon-contract';

/** Random 64-bit id of one play attempt, kept only in page memory (never stored on the device). */
export function randomAttemptId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface PlayedRange {
  start: number;
  end: number;
}

/** TimeRanges -> plain ranges (TimeRanges throws on bad indexes, so this never does). */
export function playedRanges(ranges: TimeRanges | null | undefined): PlayedRange[] {
  if (!ranges) return [];
  const out: PlayedRange[] = [];
  try {
    for (let i = 0; i < ranges.length; i += 1) out.push({ start: ranges.start(i), end: ranges.end(i) });
  } catch {
    return out;
  }
  return out;
}

/**
 * Which 1% buckets of the video were played: bucket k counts when the played ranges cover its middle.
 * Encoded MSB-first as 25 hex digits (bit 0 = first 1%), or null when nothing is known.
 */
export function watchedBitmapHex(ranges: PlayedRange[], durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || ranges.length === 0) return null;
  const bits = new Array<number>(WATCHED_BUCKETS).fill(0);
  for (let k = 0; k < WATCHED_BUCKETS; k += 1) {
    const middle = ((k + 0.5) / WATCHED_BUCKETS) * durationSeconds;
    if (ranges.some((range) => range.start <= middle && middle <= range.end)) bits[k] = 1;
  }
  if (!bits.includes(1)) return null;
  let hex = '';
  for (let i = 0; i < WATCHED_HEX_LENGTH; i += 1) {
    const nibble = (bits[i * 4] << 3) | (bits[i * 4 + 1] << 2) | (bits[i * 4 + 2] << 1) | bits[i * 4 + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Quality of experience of one play attempt (definitions after Mux Data: startup time from the play
 * request to the first frame; rebuffering = stalls after the first frame; exit before start = the
 * viewer asked to play and left before a frame showed). `collect()` returns what changed since the
 * previous call, so every beacon carries deltas and the server just sums them.
 */
export class PlaybackQoeTracker {
  readonly attempt: string;
  private requestedAt: number | null = null;
  private started = false;
  private startReported = false;
  private startupMs: number | null = null;
  private playingSince: number | null = null;
  private rebufferingSince: number | null = null;
  private seeking = false;
  private watchMs = 0;
  private rebufferCount = 0;
  private rebufferMs = 0;
  private switches = 0;
  private bitrateKbps: number | null = null;
  private maxHeight: number | null = null;
  private errorCode: string | null = null;
  private fatalError = false;
  private lastWatched: string | null = null;
  private finished = false;

  constructor(
    readonly videoId: string,
    private readonly now: () => number = () => performance.now(),
    attempt: string = randomAttemptId(),
  ) {
    this.attempt = attempt;
  }

  /** Playback was requested (autoplay or the viewer). */
  playRequested() {
    if (this.requestedAt === null) this.requestedAt = this.now();
  }

  /** A frame is moving: first frame, or the end of a stall. */
  playing() {
    const t = this.now();
    if (!this.started) {
      this.started = true;
      this.startupMs = Math.max(0, Math.round(t - (this.requestedAt ?? t)));
    }
    if (this.rebufferingSince !== null) {
      this.rebufferMs += t - this.rebufferingSince;
      this.rebufferingSince = null;
    }
    this.seeking = false;
    if (this.playingSince === null) this.playingSince = t;
  }

  /** A seek began: the wait for data that follows is seek latency, not rebuffering. */
  seekStarted() {
    this.stopWatchClock();
    this.endStall();
    this.seeking = true;
  }

  /** The player stalled waiting for data. Only stalls after the first frame count as rebuffering. */
  waiting() {
    this.stopWatchClock();
    if (this.started && !this.seeking && this.rebufferingSince === null) {
      this.rebufferCount += 1;
      this.rebufferingSince = this.now();
    }
  }

  paused() {
    this.stopWatchClock();
    this.endStall();
  }

  ended() {
    this.paused();
  }

  qualityChanged(height: number | null | undefined, bitrate: number | null | undefined) {
    if (this.maxHeight !== null || this.bitrateKbps !== null) this.switches += 1;
    if (height && height > 0) this.maxHeight = Math.max(this.maxHeight ?? 0, Math.round(height));
    if (bitrate && bitrate > 0) this.bitrateKbps = Math.round(bitrate / 1000);
  }

  error(code: string, fatal: boolean) {
    this.errorCode = code.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64) || 'unknown';
    this.fatalError = this.fatalError || fatal;
  }

  /**
   * Deltas since the previous call, or null when nothing changed. `final` = the attempt is over (page
   * hidden for good, video switched, player unmounted): a requested but never started attempt is then
   * reported as an exit before start.
   */
  collect(watchedHex: string | null, final = false): BeaconPlayback | null {
    if (this.finished) return null;
    const t = this.now();
    if (this.playingSince !== null) {
      this.watchMs += t - this.playingSince;
      this.playingSince = final ? null : t;
    }
    if (this.rebufferingSince !== null) {
      this.rebufferMs += t - this.rebufferingSince;
      this.rebufferingSince = final ? null : t;
    }

    const item: BeaconPlayback = { attempt: this.attempt, videoId: this.videoId };
    let changed = false;
    if (this.started && !this.startReported) {
      item.started = true;
      if (this.startupMs !== null) item.startupMs = this.startupMs;
      this.startReported = true;
      changed = true;
    }
    if (final && !this.started && this.requestedAt !== null) {
      item.exitedBeforeStart = true;
      changed = true;
    }
    const watch = Math.round(this.watchMs);
    if (watch > 0) { item.watchMs = watch; changed = true; }
    if (this.rebufferCount > 0) { item.rebufferCount = this.rebufferCount; changed = true; }
    const stall = Math.round(this.rebufferMs);
    if (stall > 0) { item.rebufferMs = stall; changed = true; }
    if (this.switches > 0) { item.switches = this.switches; changed = true; }
    if (this.errorCode) {
      item.errorCode = this.errorCode;
      if (this.fatalError) item.fatalError = true;
      changed = true;
    }
    if (watchedHex && watchedHex !== this.lastWatched) {
      item.watched = watchedHex;
      this.lastWatched = watchedHex;
      changed = true;
    }
    if (changed) {
      if (this.bitrateKbps !== null) item.bitrateKbps = this.bitrateKbps;
      if (this.maxHeight !== null) item.maxHeight = this.maxHeight;
    }

    this.watchMs = 0;
    this.rebufferCount = 0;
    this.rebufferMs = 0;
    this.switches = 0;
    this.errorCode = null;
    this.fatalError = false;
    if (final) this.finished = true;
    return changed ? item : null;
  }

  private stopWatchClock() {
    if (this.playingSince !== null) {
      this.watchMs += this.now() - this.playingSince;
      this.playingSince = null;
    }
  }

  private endStall() {
    if (this.rebufferingSince !== null) {
      this.rebufferMs += this.now() - this.rebufferingSince;
      this.rebufferingSince = null;
    }
  }
}
