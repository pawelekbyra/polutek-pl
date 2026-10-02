import { beforeEach, describe, expect, it } from 'vitest';
import worker, { parsePath, verifyToken } from '@/workers/hls-edge/worker.mjs';
import { SelfHlsTokenService } from '@/lib/modules/playback/infrastructure/self-hls-token.service';

const SECRET = 'a'.repeat(40);
const VIDEO = 'c52f0407-b0e8-4b5c-b6d3-a9f152653002';
const NOW = 1_800_000_000_000;

class FakeCache {
  store = new Map<string, Response>();
  async match(req: Request) {
    const hit = this.store.get(new URL(req.url).pathname);
    if (!hit) return undefined;
    const range = req.headers.get('Range');
    const buf = new Uint8Array(await hit.clone().arrayBuffer());
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range)!;
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : buf.length - 1;
      return new Response(buf.slice(start, end + 1), { status: 206, headers: hit.headers });
    }
    return new Response(buf, { status: 200, headers: hit.headers });
  }
  async put(req: Request, res: Response) {
    this.store.set(new URL(req.url).pathname, new Response(await res.arrayBuffer(), { headers: res.headers }));
  }
}

function makeEnv(objects: Record<string, string>) {
  const gets: string[] = [];
  return {
    gets,
    env: {
      HLS_TOKEN_SECRET: SECRET,
      ALLOWED_ORIGINS: 'https://www.pawelperfect.com',
      HLS: {
        async get(key: string) {
          gets.push(key);
          const v = objects[key];
          return v === undefined ? null : { body: v, httpEtag: '"e"' };
        },
      },
    },
  };
}

const ctx = { waitUntil: (p: Promise<unknown>) => void p };

function url(token: string, rest = 'master.m3u8') {
  return `https://video.pawelperfect.com/h/${token}/${VIDEO}/v1/${rest}`;
}

describe('hls edge worker', () => {
  let cache: FakeCache;
  beforeEach(() => {
    cache = new FakeCache();
    (globalThis as unknown as { caches: unknown }).caches = { default: cache };
    (globalThis as unknown as { Date: DateConstructor }).Date = Date;
  });

  it('accepts tokens signed by the app and rejects tampering/expiry', async () => {
    const { token } = SelfHlsTokenService.sign({ videoId: VIDEO, version: 'v1', secret: SECRET, nowMs: NOW }, 'https://x');
    const nowS = Math.floor(NOW / 1000);
    expect(await verifyToken(SECRET, VIDEO, 'v1', token, nowS)).toBe(true);
    expect(await verifyToken(SECRET, VIDEO, 'v2', token, nowS)).toBe(false);
    expect(await verifyToken(SECRET, 'other-video-id', 'v1', token, nowS)).toBe(false);
    expect(await verifyToken('b'.repeat(40), VIDEO, 'v1', token, nowS)).toBe(false);
    expect(await verifyToken(SECRET, VIDEO, 'v1', token, nowS + 7 * 3600)).toBe(false);
    const [exp, sig] = token.split('.');
    expect(await verifyToken(SECRET, VIDEO, 'v1', `${Number(exp) + 1}.${sig}`, nowS)).toBe(false);
    expect(await verifyToken(SECRET, VIDEO, 'v1', 'garbage', nowS)).toBe(false);
  });

  it('parses only well-formed media paths', () => {
    expect(parsePath(`/h/t/${VIDEO}/v1/720p/seg_00001.m4s`)?.ext).toBe('m4s');
    expect(parsePath(`/h/t/${VIDEO}/v1/meta.json`)).toBeNull();
    expect(parsePath(`/h/t/${VIDEO}/v1/../x.m3u8`)).toBeNull();
    expect(parsePath('/other')).toBeNull();
  });

  it('serves a valid token from R2, then from cache without touching R2', async () => {
    const { env, gets } = makeEnv({ [`videos/${VIDEO}/v/v1/master.m3u8`]: '#EXTM3U\n' });
    const real = Date.now;
    Date.now = () => NOW;
    try {
      const { token } = SelfHlsTokenService.sign({ videoId: VIDEO, version: 'v1', secret: SECRET, nowMs: NOW }, 'https://x');
      const first = await worker.fetch(new Request(url(token), { headers: { Origin: 'https://www.pawelperfect.com' } }), env, ctx);
      expect(first.status).toBe(200);
      expect(first.headers.get('content-type')).toBe('application/vnd.apple.mpegurl');
      expect(first.headers.get('access-control-allow-origin')).toBe('https://www.pawelperfect.com');
      expect(await first.text()).toBe('#EXTM3U\n');
      await new Promise((r) => setTimeout(r, 5));
      const second = await worker.fetch(new Request(url(token)), env, ctx);
      expect(second.headers.get('x-hls-cache')).toBe('HIT');
      expect(gets).toHaveLength(1);
    } finally {
      Date.now = real;
    }
  });

  it('403 without a valid token even when the object is cached', async () => {
    const { env } = makeEnv({ [`videos/${VIDEO}/v/v1/master.m3u8`]: 'x' });
    const real = Date.now;
    Date.now = () => NOW;
    try {
      const { token } = SelfHlsTokenService.sign({ videoId: VIDEO, version: 'v1', secret: SECRET, nowMs: NOW }, 'https://x');
      await worker.fetch(new Request(url(token)), env, ctx);
      await new Promise((r) => setTimeout(r, 5));
      const bad = await worker.fetch(new Request(url(`${Math.floor(NOW / 1000) + 100}.${'A'.repeat(43)}`)), env, ctx);
      expect(bad.status).toBe(403);
      expect(bad.headers.get('cache-control')).toBe('no-store');
    } finally {
      Date.now = real;
    }
  });

  it('answers Range requests with 206 and immutable segments', async () => {
    const { env } = makeEnv({ [`videos/${VIDEO}/v/v1/720p/seg_00000.m4s`]: '0123456789' });
    const real = Date.now;
    Date.now = () => NOW;
    try {
      const { token } = SelfHlsTokenService.sign({ videoId: VIDEO, version: 'v1', secret: SECRET, nowMs: NOW }, 'https://x');
      const res = await worker.fetch(new Request(url(token, '720p/seg_00000.m4s'), { headers: { Range: 'bytes=2-4' } }), env, ctx);
      expect(res.status).toBe(206);
      expect(await res.text()).toBe('234');
      expect(res.headers.get('cache-control')).toContain('immutable');
    } finally {
      Date.now = real;
    }
  });

  it('handles CORS preflight and unknown objects', async () => {
    const { env } = makeEnv({});
    const pre = await worker.fetch(new Request(url('t'), { method: 'OPTIONS', headers: { Origin: 'https://www.pawelperfect.com' } }), env, ctx);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toBe('Range');
    const real = Date.now;
    Date.now = () => NOW;
    try {
      const { token } = SelfHlsTokenService.sign({ videoId: VIDEO, version: 'v1', secret: SECRET, nowMs: NOW }, 'https://x');
      expect((await worker.fetch(new Request(url(token)), env, ctx)).status).toBe(404);
    } finally {
      Date.now = real;
    }
  });
});
