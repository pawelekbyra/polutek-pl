import { describe, expect, it, vi } from 'vitest';
import { classifyBrowser, classifyDevice, classifyOs, isBotUserAgent, normalizeCountry, normalizePath } from '@/services/pp-collector/src/classify';
import { SaltCache, attemptId, warsawDay, watchedBits, type SaltStore } from '@/services/pp-collector/src/visitor';
import { TokenBucketLimiter } from '@/services/pp-collector/src/rate-limit';
import { RowBuffer } from '@/services/pp-collector/src/buffer';
import { rollupDays, runExclusive } from '@/services/pp-collector/src/maintenance';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0';
const IPAD_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

describe('classification', () => {
  it('classifies device, browser and system coarsely', () => {
    expect([classifyDevice(IPHONE), classifyBrowser(IPHONE), classifyOs(IPHONE)]).toEqual(['mobile', 'Safari', 'iOS']);
    expect([classifyDevice(WINDOWS_EDGE), classifyBrowser(WINDOWS_EDGE), classifyOs(WINDOWS_EDGE)]).toEqual(['desktop', 'Edge', 'Windows']);
    expect(classifyDevice(IPAD_TABLET)).toBe('tablet');
  });

  it('recognises crawlers, previews, headless browsers and empty agents as bots', () => {
    for (const ua of ['', 'short', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36', 'python-requests/2.32.3 something long enough']) {
      expect(isBotUserAgent(ua), ua).toBe(true);
    }
    expect(isBotUserAgent(IPHONE)).toBe(false);
  });

  it('keeps only real-looking paths and ISO countries', () => {
    expect(normalizePath('/pl/regulamin/')).toBe('/pl/regulamin');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/a b')).toBeNull();
    expect(normalizePath('https://x')).toBeNull();
    expect(normalizeCountry('pl')).toBe('PL');
    expect(normalizeCountry('T1')).toBeNull();
    expect(normalizeCountry('XX')).toBeNull();
  });
});

describe('visitor helpers', () => {
  it('uses the Europe/Warsaw calendar day', () => {
    expect(warsawDay(new Date('2026-10-04T21:59:59Z'))).toBe('2026-10-04');
    expect(warsawDay(new Date('2026-10-04T22:00:00Z'))).toBe('2026-10-05');
    expect(warsawDay(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01');
  });

  it('converts attempt ids and bitmaps losslessly', () => {
    expect(attemptId('7fffffffffffffff')).toBe(9223372036854775807n);
    expect(attemptId('8000000000000000')).toBe(-9223372036854775808n);
    expect(watchedBits('a' + '0'.repeat(23) + '1')).toBe('1010' + '0'.repeat(92) + '0001');
  });

  it('creates one salt per day and deletes the previous days', async () => {
    const store: SaltStore = {
      getOrCreate: vi.fn(async (day: string) => Buffer.from(day)),
      deleteBefore: vi.fn(async () => undefined),
    };
    const cache = new SaltCache(store);
    const day1 = new Date('2026-10-04T10:00:00Z');
    const [a, b] = await Promise.all([cache.get(day1), cache.get(day1)]);
    expect(a.toString()).toBe('2026-10-04');
    expect(b).toBe(a);
    expect(store.getOrCreate).toHaveBeenCalledTimes(1);
    const next = await cache.get(new Date('2026-10-05T10:00:00Z'));
    expect(next.toString()).toBe('2026-10-05');
    expect(store.deleteBefore).toHaveBeenLastCalledWith('2026-10-05');
  });

  it('rebuilds today and yesterday', () => {
    expect(rollupDays(new Date('2026-10-05T00:30:00+02:00'))).toEqual(['2026-10-04', '2026-10-05']);
  });
});

describe('limits', () => {
  it('lets a burst through and then refills slowly', () => {
    const limiter = new TokenBucketLimiter(3, 1);
    expect([limiter.take('a', 0), limiter.take('a', 0), limiter.take('a', 0), limiter.take('a', 0)]).toEqual([true, true, true, false]);
    expect(limiter.take('b', 0)).toBe(true);
    expect(limiter.take('a', 1000)).toBe(true);
  });

  it('bounds the number of tracked keys', () => {
    const limiter = new TokenBucketLimiter(5, 1, 2);
    expect([limiter.take('a', 0), limiter.take('b', 0), limiter.take('c', 0)]).toEqual([true, true, false]);
  });

  it('drops batches that would overflow the buffer', () => {
    const buffer = new RowBuffer(2);
    const row = { ts: new Date(), path: '/', metric: 'LCP', value: 1, rating: null, nav_type: null, device: 'desktop' };
    expect(buffer.add({ pageViews: [], vitals: [row, row], playback: [] })).toBe(true);
    expect(buffer.add({ pageViews: [], vitals: [row], playback: [] })).toBe(false);
    expect(buffer.dropped).toBe(1);
    expect(buffer.drain().vitals).toHaveLength(2);
    expect(buffer.size).toBe(0);
  });
});

describe('maintenance single flight (W23)', () => {
  it('skips a tick while the same job still runs, and runs again once it finished', async () => {
    let release!: () => void;
    const slow = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const first = runExclusive('rollup', slow);
    expect(await runExclusive('rollup', slow)).toBe(false);
    expect(slow).toHaveBeenCalledTimes(1);
    expect(await runExclusive('retention', async () => undefined)).toBe(true); // other jobs are independent
    release();
    expect(await first).toBe(true);
    expect(await runExclusive('rollup', async () => undefined)).toBe(true);
  });

  it('frees the slot when the job fails', async () => {
    await expect(runExclusive('rollup', async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await runExclusive('rollup', async () => undefined)).toBe(true);
  });
});
