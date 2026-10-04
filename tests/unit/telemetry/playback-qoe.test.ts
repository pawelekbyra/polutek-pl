import { describe, expect, it } from 'vitest';
import { PlaybackQoeTracker, watchedBitmapHex } from '@/lib/telemetry/client/playback-qoe';

function tracker() {
  let t = 0;
  const qoe = new PlaybackQoeTracker('video_1', () => t, '0123456789abcdef');
  return { qoe, advance: (ms: number) => { t += ms; } };
}

describe('PlaybackQoeTracker', () => {
  it('measures startup from the play request to the first frame, once', () => {
    const { qoe, advance } = tracker();
    qoe.playRequested();
    advance(700);
    qoe.playing();
    advance(5000);
    expect(qoe.collect(null)).toEqual({ attempt: '0123456789abcdef', videoId: 'video_1', started: true, startupMs: 700, watchMs: 5000 });
    advance(1000);
    expect(qoe.collect(null)).toEqual({ attempt: '0123456789abcdef', videoId: 'video_1', watchMs: 1000 });
  });

  it('counts stalls after the first frame as rebuffering, but not the wait after a seek', () => {
    const { qoe, advance } = tracker();
    qoe.playRequested();
    qoe.waiting(); // before the first frame: part of startup
    advance(300);
    qoe.playing();
    advance(2000);
    qoe.waiting();
    advance(1500);
    qoe.playing();
    qoe.seekStarted();
    qoe.waiting();
    advance(800);
    qoe.playing();
    const item = qoe.collect(null);
    expect(item).toMatchObject({ startupMs: 300, rebufferCount: 1, rebufferMs: 1500, watchMs: 2000 });
  });

  it('does not count paused time as watch time', () => {
    const { qoe, advance } = tracker();
    qoe.playRequested();
    qoe.playing();
    advance(1000);
    qoe.paused();
    advance(60_000);
    expect(qoe.collect(null)?.watchMs).toBe(1000);
  });

  it('reports an exit before start only when the attempt ends without a frame', () => {
    const { qoe, advance } = tracker();
    qoe.playRequested();
    advance(4000);
    expect(qoe.collect(null)).toBeNull();
    expect(qoe.collect(null, true)).toEqual({ attempt: '0123456789abcdef', videoId: 'video_1', exitedBeforeStart: true });
    expect(qoe.collect(null, true)).toBeNull();
  });

  it('records errors, quality changes and the watched bitmap only when they change', () => {
    const { qoe } = tracker();
    qoe.qualityChanged(720, 2_800_000);
    qoe.qualityChanged(1080, 5_000_000);
    qoe.error('hls:networkError:fragLoadError <x>', false);
    const first = qoe.collect('8' + '0'.repeat(24));
    expect(first).toMatchObject({ switches: 1, maxHeight: 1080, bitrateKbps: 5000, errorCode: 'hls:networkError:fragLoadErrorx', watched: '8' + '0'.repeat(24) });
    expect(first?.fatalError).toBeUndefined();
    expect(qoe.collect('8' + '0'.repeat(24))).toBeNull();
  });
});

describe('watchedBitmapHex', () => {
  it('marks the 1% buckets whose middle was played, MSB first', () => {
    expect(watchedBitmapHex([{ start: 0, end: 4 }], 100)).toBe('f' + '0'.repeat(24));
    expect(watchedBitmapHex([{ start: 99, end: 100 }], 100)).toBe('0'.repeat(24) + '1');
    expect(watchedBitmapHex([], 100)).toBeNull();
    expect(watchedBitmapHex([{ start: 0, end: 1 }], Number.NaN)).toBeNull();
  });
});
