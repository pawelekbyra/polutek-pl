import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_BEACONS_PER_PAGE,
  configureBeacon,
  flushBeacon,
  queuePageView,
  queueWebVital,
  registerPlaybackCollector,
  resetBeaconQueueForTests,
  trackingOptedOut,
} from '@/lib/telemetry/client/beacon-queue';
import { beaconSchema } from '@/lib/telemetry/beacon-contract';

const sendBeacon = vi.fn((_url: string, _data: Blob) => true);

async function sentPayloads() {
  return Promise.all(sendBeacon.mock.calls.map(async ([, blob]) => JSON.parse(await blob.text())));
}

type TestNavigator = { sendBeacon: typeof sendBeacon; doNotTrack: string | null; webdriver: boolean; globalPrivacyControl?: boolean };
let nav: TestNavigator;

beforeEach(() => {
  resetBeaconQueueForTests();
  sendBeacon.mockClear();
  nav = { sendBeacon, doNotTrack: null, webdriver: false };
  vi.stubGlobal('navigator', nav);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('beacon queue', () => {
  it('sends the page view, vitals and playback together, in a body the collector accepts', async () => {
    configureBeacon({ enabled: true, signedIn: true });
    queuePageView({ path: '/en' });
    queueWebVital({ name: 'LCP', value: 1000, rating: 'good', path: '/en' });
    queueWebVital({ name: 'LCP', value: 1200, rating: 'good', path: '/en' });
    registerPlaybackCollector('a', () => ({ attempt: '0123456789abcdef', videoId: 'v1', watchMs: 1000 }));

    expect(flushBeacon(false)).toBe(true);
    expect(sendBeacon).toHaveBeenCalledWith('/api/t', expect.any(Blob));
    const [payload] = await sentPayloads();
    expect(beaconSchema.safeParse(payload).success).toBe(true);
    expect(payload).toEqual({
      v: 1,
      signedIn: true,
      pageView: { path: '/en' },
      vitals: [{ name: 'LCP', value: 1200, rating: 'good', path: '/en' }],
      playback: [{ attempt: '0123456789abcdef', videoId: 'v1', watchMs: 1000 }],
    });
    // Nothing new: no second request.
    registerPlaybackCollector('a', () => null);
    expect(flushBeacon(false)).toBe(false);
  });

  it('stays silent under Do Not Track, Global Privacy Control and in automated browsers', () => {
    nav.globalPrivacyControl = true;
    expect(trackingOptedOut()).toBe(true);
    configureBeacon({ enabled: true, signedIn: false });
    queuePageView({ path: '/en' });
    expect(flushBeacon(true)).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();

    expect(trackingOptedOut({ doNotTrack: '1' } as Navigator)).toBe(true);
    expect(trackingOptedOut({ webdriver: true } as Navigator)).toBe(true);
    expect(trackingOptedOut({ doNotTrack: null, webdriver: false } as unknown as Navigator)).toBe(false);
  });

  it('does nothing when the server turned the beacon off', () => {
    configureBeacon({ enabled: false, signedIn: false });
    queuePageView({ path: '/en' });
    expect(flushBeacon(true)).toBe(false);
  });

  it('sends the previous page view before queueing a new one', async () => {
    configureBeacon({ enabled: true, signedIn: false });
    queuePageView({ path: '/en' });
    queuePageView({ path: '/en/terms' });
    flushBeacon(false);
    expect((await sentPayloads()).map((p) => p.pageView.path)).toEqual(['/en', '/en/terms']);
  });

  it('reports a player one last time when it unmounts', async () => {
    configureBeacon({ enabled: true, signedIn: false });
    const collect = vi.fn((final: boolean) => (final ? { attempt: '0123456789abcdef', videoId: 'v1', exitedBeforeStart: true } : null));
    const unregister = registerPlaybackCollector('a', collect);
    unregister();
    flushBeacon(false);
    expect(collect).toHaveBeenCalledWith(true);
    expect((await sentPayloads())[0].playback).toEqual([{ attempt: '0123456789abcdef', videoId: 'v1', exitedBeforeStart: true }]);
  });

  it('caps the number of beacons per page', () => {
    configureBeacon({ enabled: true, signedIn: false });
    for (let i = 0; i < MAX_BEACONS_PER_PAGE + 5; i += 1) {
      queuePageView({ path: `/p${i}` });
      flushBeacon(false);
    }
    expect(sendBeacon).toHaveBeenCalledTimes(MAX_BEACONS_PER_PAGE);
  });
});
