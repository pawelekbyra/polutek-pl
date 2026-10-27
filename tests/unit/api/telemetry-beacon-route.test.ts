import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pending: Array<() => Promise<void>> = [];
vi.mock('next/server', () => ({ after: (task: () => Promise<void>) => pending.push(task) }));

import { POST } from '@/app/api/t/route';
import { isTelemetryBeaconEnabled } from '@/lib/telemetry/config';

const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

function beacon(body: string, headers: Record<string, string> = {}) {
  return new Request('https://www.pawelperfect.com/api/t', {
    method: 'POST',
    body,
    headers: { 'content-type': 'text/plain;charset=UTF-8', 'user-agent': 'UA', origin: 'https://www.pawelperfect.com', ...headers },
  });
}

async function runAfter() {
  while (pending.length) await pending.shift()!();
}

beforeEach(() => {
  pending.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('TELEMETRY_COLLECTOR_URL', 'http://collector:3200/');
  vi.stubEnv('TELEMETRY_BEACON', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/t', () => {
  it('drops an oversized body even without a Content-Length, and never forwards it (audit S03)', async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(40_000))); controller.close(); } });
    const req = new Request('https://www.pawelperfect.com/api/t', { method: 'POST', body: stream, headers: { 'content-type': 'text/plain' }, duplex: 'half' } as RequestInit);
    const res = await POST(req);
    expect(res.status).toBe(204);
    await runAfter();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 204 at once and hands the body to the collector afterwards, without cookies', async () => {
    const res = await POST(beacon('{"v":1}', { 'cf-ipcountry': 'PL', 'cf-connecting-ip': '203.0.113.5', 'sec-gpc': '1' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    await runAfter();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://collector:3200/api/t');
    expect(init.body).toBe('{"v":1}');
    expect(init.headers).toMatchObject({ 'x-pp-country': 'PL', 'x-pp-origin': 'https://www.pawelperfect.com', 'x-pp-dnt': '1', 'user-agent': 'UA' });
  });

  it('is fail-open: a collector that is down does not change the answer', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'));
    const res = await POST(beacon('{"v":1}'));
    await expect(runAfter()).resolves.toBeUndefined();
    expect(res.status).toBe(204);
  });

  it('drops everything when no collector is configured or the body is too big', async () => {
    vi.stubEnv('TELEMETRY_COLLECTOR_URL', '');
    expect((await POST(beacon('{"v":1}'))).status).toBe(204);
    vi.stubEnv('TELEMETRY_COLLECTOR_URL', 'http://collector:3200');
    expect((await POST(beacon('x'.repeat(20_000)))).status).toBe(204);
    await runAfter();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('beacon switch', () => {
  it('is on only with a collector, and TELEMETRY_BEACON=off turns it off', () => {
    expect(isTelemetryBeaconEnabled({ TELEMETRY_COLLECTOR_URL: 'http://collector:3200' })).toBe(true);
    expect(isTelemetryBeaconEnabled({ TELEMETRY_COLLECTOR_URL: 'http://collector:3200', TELEMETRY_BEACON: 'off' })).toBe(false);
    expect(isTelemetryBeaconEnabled({})).toBe(false);
  });
});
