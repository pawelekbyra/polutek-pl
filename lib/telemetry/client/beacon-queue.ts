import { BEACON_MAX_BYTES, BEACON_PATH, BEACON_VERSION } from '@/lib/telemetry/beacon-constants';
import type { BeaconPageView, BeaconPayload, BeaconPlayback, BeaconWebVital } from '@/lib/telemetry/beacon-contract';

/**
 * Page-wide queue of the analytics beacon (one per document). Collects the page view, Web Vitals and
 * playback quality, and sends them together with navigator.sendBeacon: typically 1-3 requests per
 * page view (after load, when the page is hidden, and every few minutes during long playback).
 * Nothing is stored on the device. Disabled entirely under Do Not Track / Global Privacy Control and
 * in automated browsers.
 */

export type PlaybackCollector = (final: boolean) => BeaconPlayback | null;

interface QueueState {
  enabled: boolean;
  signedIn: boolean;
  pageView: BeaconPageView | null;
  vitals: BeaconWebVital[];
  collectors: Map<string, PlaybackCollector>;
  pendingPlayback: BeaconPlayback[];
  sent: number;
}

/** Hard cap per document: a page left open for days cannot turn into a stream of requests. */
export const MAX_BEACONS_PER_PAGE = 50;

const state: QueueState = {
  enabled: false,
  signedIn: false,
  pageView: null,
  vitals: [],
  collectors: new Map(),
  pendingPlayback: [],
  sent: 0,
};

type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };

/** Do Not Track or Global Privacy Control set, or an automated browser: the beacon stays off. */
export function trackingOptedOut(nav: PrivacyNavigator | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav) return true;
  const dnt = nav.doNotTrack ?? nav.msDoNotTrack ?? (typeof window !== 'undefined' ? (window as Window & { doNotTrack?: string }).doNotTrack : undefined);
  return dnt === '1' || dnt === 'yes' || nav.globalPrivacyControl === true || nav.webdriver === true;
}

export function configureBeacon(options: { enabled: boolean; signedIn: boolean }) {
  state.enabled = options.enabled && !trackingOptedOut();
  state.signedIn = options.signedIn;
}

export function isBeaconEnabled(): boolean {
  return state.enabled;
}

export function queuePageView(pageView: BeaconPageView) {
  if (!state.enabled) return;
  // A new page while the previous view is still unsent: send that one first (one view per beacon).
  if (state.pageView) flushBeacon(false);
  state.pageView = pageView;
}

export function queueWebVital(vital: BeaconWebVital) {
  if (!state.enabled) return;
  state.vitals = state.vitals.filter((queued) => queued.name !== vital.name || queued.path !== vital.path);
  state.vitals.push(vital);
}

/** Registers the playback tracker of a mounted player. The returned function reports it one last time. */
export function registerPlaybackCollector(id: string, collect: PlaybackCollector): () => void {
  state.collectors.set(id, collect);
  return () => {
    if (!state.collectors.has(id)) return;
    state.collectors.delete(id);
    const last = collect(true);
    if (last && state.enabled) state.pendingPlayback.push(last);
  };
}

export function hasActivePlayback(): boolean {
  return state.collectors.size > 0;
}

function send(body: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(BEACON_PATH, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return true;
    }
    void fetch(BEACON_PATH, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends whatever is queued. `final` = the page is going away (hidden/pagehide): playback trackers then
 * report open attempts as finished. Returns whether a beacon went out.
 */
export function flushBeacon(final: boolean): boolean {
  if (!state.enabled) return false;
  const playback = state.pendingPlayback;
  state.pendingPlayback = [];
  for (const collect of state.collectors.values()) {
    const item = collect(final);
    if (item) playback.push(item);
  }
  if (!state.pageView && state.vitals.length === 0 && playback.length === 0) return false;
  if (state.sent >= MAX_BEACONS_PER_PAGE) return false;

  const payload: BeaconPayload = { v: BEACON_VERSION, signedIn: state.signedIn };
  if (state.pageView) payload.pageView = state.pageView;
  if (state.vitals.length) payload.vitals = state.vitals.slice(0, 20);
  if (playback.length) payload.playback = playback.slice(0, 10);
  const body = JSON.stringify(payload);
  state.pageView = null;
  state.vitals = [];
  if (body.length > BEACON_MAX_BYTES) return false;
  state.sent += 1;
  return send(body);
}

/** Test helper: back to a fresh document. */
export function resetBeaconQueueForTests() {
  state.enabled = false;
  state.signedIn = false;
  state.pageView = null;
  state.vitals = [];
  state.collectors.clear();
  state.pendingPlayback = [];
  state.sent = 0;
}
