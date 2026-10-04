import { describe, expect, it } from 'vitest';
import { processBeacon, type BeaconRequest, type CollectorPolicy } from '@/services/pp-collector/src/handler';
import { BEACON_MAX_BYTES } from '@/lib/telemetry/beacon-constants';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const SALT = Buffer.alloc(32, 7);
const NOW = new Date('2026-10-05T10:00:00Z');
const allowAll: CollectorPolicy = { allowedHosts: ['www.pawelperfect.com'], take: () => true };

function request(body: unknown, overrides: Partial<BeaconRequest> = {}): BeaconRequest {
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ip: '203.0.113.9',
    userAgent: CHROME_ANDROID,
    country: 'PL',
    origin: 'https://www.pawelperfect.com',
    referer: undefined,
    doNotTrack: false,
    ...overrides,
  };
}

const pageView = {
  v: 1,
  signedIn: true,
  pageView: {
    path: '/en/watch/abc/?x=1',
    referrer: 'https://www.google.com/search?q=secret',
    utmSource: 'Newsletter!',
    lang: 'en',
  },
};

describe('processBeacon', () => {
  it('turns a page view into an anonymous row: no IP, no user agent, no query, referrer host only', () => {
    const outcome = processBeacon(request(pageView), SALT, NOW, allowAll);
    expect(outcome.reason).toBe('accepted');
    if (outcome.reason !== 'accepted') return;
    const [row] = outcome.rows.pageViews;
    expect(row).toMatchObject({
      path: '/en/watch/abc',
      referrer_host: 'google.com',
      utm_source: 'newsletter',
      country: 'PL',
      device: 'mobile',
      browser: 'Chrome',
      os: 'Android',
      lang: 'en',
      signed_in: true,
    });
    expect(row.visitor).toMatch(/^-?\d+$/);
    expect(JSON.stringify(outcome.rows)).not.toContain('203.0.113.9');
    expect(JSON.stringify(outcome.rows)).not.toContain('Pixel 8');
    expect(JSON.stringify(outcome.rows)).not.toContain('secret');
  });

  it('gives the same visitor the same id within a salt and a different one with another salt', () => {
    const first = processBeacon(request(pageView), SALT, NOW, allowAll);
    const again = processBeacon(request(pageView), SALT, NOW, allowAll);
    const nextDay = processBeacon(request(pageView), Buffer.alloc(32, 8), NOW, allowAll);
    const other = processBeacon(request(pageView, { ip: '203.0.113.10' }), SALT, NOW, allowAll);
    const id = (o: typeof first) => (o.reason === 'accepted' ? o.rows.pageViews[0].visitor : null);
    expect(id(again)).toBe(id(first));
    expect(id(nextDay)).not.toBe(id(first));
    expect(id(other)).not.toBe(id(first));
  });

  it('treats our own site as an internal referrer', () => {
    const outcome = processBeacon(
      request({ v: 1, pageView: { path: '/en', referrer: 'https://www.pawelperfect.com/pl' } }),
      SALT,
      NOW,
      allowAll,
    );
    expect(outcome.reason === 'accepted' && outcome.rows.pageViews[0].referrer_host).toBeNull();
  });

  it('drops Do Not Track / Global Privacy Control, bots and automated browsers without counting them', () => {
    expect(processBeacon(request(pageView, { doNotTrack: true }), SALT, NOW, allowAll)).toEqual({ status: 204, reason: 'dnt' });
    expect(processBeacon(request(pageView, { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }), SALT, NOW, allowAll).reason).toBe('bot');
    expect(processBeacon(request(pageView, { userAgent: 'curl/8.5.0' }), SALT, NOW, allowAll).reason).toBe('bot');
    expect(processBeacon(request({ ...pageView, automated: true }), SALT, NOW, allowAll).reason).toBe('automated');
  });

  it('rejects other origins, oversized and malformed bodies', () => {
    expect(processBeacon(request(pageView, { origin: 'https://evil.example' }), SALT, NOW, allowAll).status).toBe(403);
    expect(processBeacon(request(pageView, { origin: undefined, referer: undefined }), SALT, NOW, allowAll).status).toBe(403);
    expect(processBeacon(request(pageView, { origin: undefined, referer: 'https://www.pawelperfect.com/en' }), SALT, NOW, allowAll).reason).toBe('accepted');
    expect(processBeacon(request('x'.repeat(BEACON_MAX_BYTES + 1)), SALT, NOW, allowAll).status).toBe(413);
    expect(processBeacon(request('{not json'), SALT, NOW, allowAll).status).toBe(400);
    expect(processBeacon(request({ v: 2, pageView: pageView.pageView }), SALT, NOW, allowAll).status).toBe(400);
    expect(processBeacon(request({ v: 1, playback: [{ attempt: 'nothex', videoId: 'v1' }] }), SALT, NOW, allowAll).status).toBe(400);
  });

  it('applies the rate limit per visitor', () => {
    let calls = 0;
    const limited: CollectorPolicy = { allowedHosts: allowAll.allowedHosts, take: () => ++calls <= 1 };
    expect(processBeacon(request(pageView), SALT, NOW, limited).reason).toBe('accepted');
    expect(processBeacon(request(pageView), SALT, NOW, limited)).toEqual({ status: 429, reason: 'rate_limited' });
  });

  it('maps playback quality, vitals and the watched bitmap', () => {
    const outcome = processBeacon(
      request({
        v: 1,
        vitals: [{ name: 'LCP', value: 1834.5, rating: 'good', navigationType: 'navigate', path: '/en' }],
        playback: [
          { attempt: '00000000000000ff', videoId: 'video_1', started: true, startupMs: 640, watchMs: 30000, rebufferCount: 1, rebufferMs: 900, maxHeight: 1080, bitrateKbps: 4500, watched: 'f' + '0'.repeat(24) },
          { attempt: 'ffffffffffffffff', videoId: 'video_2', exitedBeforeStart: true, errorCode: 'hls:networkError:manifestLoadError', fatalError: true },
        ],
      }),
      SALT,
      NOW,
      allowAll,
    );
    expect(outcome.reason).toBe('accepted');
    if (outcome.reason !== 'accepted') return;
    expect(outcome.rows.vitals).toEqual([
      { ts: NOW, path: '/en', metric: 'LCP', value: 1834.5, rating: 'good', nav_type: 'navigate', device: 'mobile' },
    ]);
    const [played, failed] = outcome.rows.playback;
    expect(played).toMatchObject({ attempt: '255', video_id: 'video_1', started: true, startup_ms: 640, watch_ms: 30000, rebuffer_count: 1, rebuffer_ms: 900, max_height: 1080, bitrate_kbps: 4500, exited_before_start: false });
    expect(played.watched).toBe('1111' + '0'.repeat(96));
    expect(failed).toMatchObject({ attempt: '-1', started: false, startup_ms: null, exited_before_start: true, error_code: 'hls:networkError:manifestLoadError', fatal_error: true, watched: null });
  });

  it('never reports a started attempt as an exit before start', () => {
    const outcome = processBeacon(
      request({ v: 1, playback: [{ attempt: '0000000000000001', videoId: 'v', started: true, exitedBeforeStart: true }] }),
      SALT,
      NOW,
      allowAll,
    );
    expect(outcome.reason === 'accepted' && outcome.rows.playback[0].exited_before_start).toBe(false);
  });

  it('drops paths that are not ours instead of storing free text', () => {
    const outcome = processBeacon(request({ v: 1, pageView: { path: '//evil.example/<script>' } }), SALT, NOW, allowAll);
    expect(outcome).toEqual({ status: 204, reason: 'empty' });
  });
});
