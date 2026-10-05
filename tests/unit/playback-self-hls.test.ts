import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { parseSelfHlsObjectKey } from '@/lib/modules/playback/application/self-hls-plan';
import { SelfHlsTokenService } from '@/lib/modules/playback/infrastructure/self-hls-token.service';
import { verifyToken } from '@/workers/hls-edge/worker.mjs';
import { resolvePlaybackSource } from '@/app/components/playback-source';
import type { Actor } from '@/lib/modules/shared/actor';

vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));

const VIDEO_ID = 'c52f0407-b0e8-4b5c-b6d3-a9f152653002';
const SECRET = 's'.repeat(40);

const asset = (over: Record<string, unknown>) => ({
  id: 'a',
  videoId: VIDEO_ID,
  provider: 'SELF_HLS',
  objectKey: `videos/${VIDEO_ID}/v/v1`,
  bucket: 'polutek-hls',
  processingState: 'READY',
  isPrimary: false,
  mimeType: null,
  sizeBytes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe('SELF_HLS playback plan', () => {
  const prisma = {
    video: { findUnique: vi.fn() },
    videoPlaybackSession: { create: vi.fn(), findUnique: vi.fn() },
  };

  const selfAsset = asset({ id: 'self', isPrimary: true });
  // Legacy provider rows that still sit in the DB (inactive): they must be ignored.
  const legacyAssets = ['CLOUDFLARE_STREAM', 'MUX', 'YOUTUBE', 'VIMEO', 'VERCEL_BLOB', 'R2'].map((provider, i) =>
    asset({ id: `legacy-${i}`, provider, objectKey: 'legacy-key', updatedAt: new Date(Date.now() + 1000 + i) }),
  );

  function video(over: Record<string, unknown> = {}) {
    return {
      id: VIDEO_ID,
      title: 'Czesc',
      thumbnailUrl: '/t.jpg',
      tier: 'LOGGED_IN',
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 86_400_000),
      premiereAt: null,
      videoUrl: 'https://raw.example.com/legacy.mp4',
      activePlaybackRoute: { asset: selfAsset },
      assets: [selfAsset, ...legacyAssets],
      ...over,
    };
  }

  const plan = (actor: Actor) =>
    PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, createAppContext({ actor, prisma: prisma as never }));

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HLS_TOKEN_SECRET = SECRET;
    delete process.env.HLS_DELIVERY_BASE_URL;
    prisma.video.findUnique.mockResolvedValue(video());
    prisma.videoPlaybackSession.create.mockResolvedValue({ id: 'sess-1' });
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as never);
  });
  afterEach(() => {
    delete process.env.HLS_TOKEN_SECRET;
  });

  it('issues a signed master URL the Worker accepts, for an allowed viewer', async () => {
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('READY');
    expect(result.source?.kind).toBe('self_hls');
    const url = new URL(result.source!.playbackUrl!);
    expect(url.origin).toBe('https://video.pawelperfect.com');
    const [, , token, id, version, file] = url.pathname.split('/');
    expect(id).toBe(VIDEO_ID);
    expect(version).toBe('v1');
    expect(file).toBe('master.m3u8');
    expect(await verifyToken(SECRET, id, version, token, Math.floor(Date.now() / 1000))).toBe(true);
    expect(result.tracking.playbackSessionId).toBe('sess-1');
    expect(prisma.videoPlaybackSession.create.mock.calls[0][0].data.sourceKind).toBe('self_hls');
    // The client player can use it.
    expect(resolvePlaybackSource({ kind: result.source!.kind, playbackUrl: result.source!.playbackUrl }).mode).toBe('custom-player');
    // Nothing of the legacy rows or the raw videoUrl leaks into the plan.
    expect(JSON.stringify(result)).not.toMatch(/legacy|raw\.example\.com|fallback/);
  });

  it('never exposes any URL or token to a denied viewer', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'LOGIN_REQUIRED' } } as never);
    const result = await plan({ type: 'guest' });
    expect(result.status).toBe('LOGIN_REQUIRED');
    expect(result.canPlay).toBe(false);
    expect(result.source).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/video\.pawelperfect\.com|self_hls|\/h\/|raw\.example\.com/);
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('keeps the premiere gate in front of own HLS', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ premiereAt: new Date(Date.now() + 86_400_000) }));
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('COMING_SOON');
    expect(JSON.stringify(result)).not.toContain('/h/');
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('ignores a legacy route and legacy assets: no own-HLS asset means nothing plays', async () => {
    prisma.video.findUnique.mockResolvedValue(video({
      activePlaybackRoute: { asset: legacyAssets[0] },
      assets: legacyAssets,
    }));
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('NO_PRIMARY_ASSET');
    expect(result.canPlay).toBe(false);
    expect(result.source).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/legacy|raw\.example\.com|\/h\//);
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('plays own HLS even when the active route still points at a legacy provider', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ activePlaybackRoute: { asset: legacyAssets[1] } }));
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('READY');
    expect(result.source?.kind).toBe('self_hls');
  });

  it('reports PROCESSING (no URL) while the own-HLS asset is still encoding', async () => {
    const encoding = asset({ id: 'enc', isPrimary: true, processingState: 'PROCESSING' });
    prisma.video.findUnique.mockResolvedValue(video({ activePlaybackRoute: null, assets: [encoding, ...legacyAssets] }));
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('PROCESSING');
    expect(result.source).toBeUndefined();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('fails closed (ERROR, no URL, no session) when the delivery secret is not configured', async () => {
    delete process.env.HLS_TOKEN_SECRET;
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('ERROR');
    expect(result.canPlay).toBe(false);
    expect(result.source).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/\/h\/|legacy/);
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('returns ERROR when resolving the source fails unexpectedly', async () => {
    prisma.videoPlaybackSession.create.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await plan({ type: 'user', userId: 'u1' });
    spy.mockRestore();
    expect(result.status).toBe('ERROR');
    expect(result.canPlay).toBe(false);
    expect(result.source).toBeUndefined();
    expect(result.diagnostics.warnings).toContain('Failed to resolve own HLS playback source');
  });

  it('says the video is unavailable when it does not exist', async () => {
    prisma.video.findUnique.mockResolvedValue(null);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as never);
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.source).toBeUndefined();
  });

  it('hands the subtitle tracks to an allowed viewer (https or same-site only)', async () => {
    prisma.video.findUnique.mockResolvedValue(video({
      subtitleUrlPl: 'https://subs.example.com/pl.vtt',
      subtitleUrlEn: 'javascript:alert(1)',
    }));
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('READY');
    expect(result.player.textTracks).toEqual([
      { src: 'https://subs.example.com/pl.vtt', label: 'Polski', language: 'pl', kind: 'subtitles' },
    ]);

    prisma.video.findUnique.mockResolvedValue(video({ subtitleUrlPl: '/subs/pl.vtt', subtitleUrlEn: 'http://plain.example.com/en.vtt' }));
    const second = await plan({ type: 'user', userId: 'u1' });
    expect(second.player.textTracks?.map((t) => t.src)).toEqual(['/subs/pl.vtt']);
  });

  describe('token renewal of an open player (reuseSessionId)', () => {
    const renew = (actor: Actor, reuseSessionId: string, fingerprint = { ip: 'ip1', ua: 'ua1' }) =>
      PlaybackService.createPlaybackPlanWithContext(
        VIDEO_ID,
        createAppContext({ actor, prisma: prisma as never }),
        fingerprint.ip,
        fingerprint.ua,
        { reuseSessionId },
      );
    const session = (over: Record<string, unknown> = {}) => ({
      id: 'sess-old', videoId: VIDEO_ID, userId: 'u1', ipHash: 'ip1', userAgentHash: 'ua1',
      isAdminPreview: false, createdAt: new Date(Date.now() - 6 * 3600_000), ...over,
    });

    it('keeps the viewer\'s own session and issues a fresh token', async () => {
      prisma.videoPlaybackSession.findUnique.mockResolvedValue(session());
      const result = await renew({ type: 'user', userId: 'u1' }, 'sess-old');
      expect(result.status).toBe('READY');
      expect(result.tracking.playbackSessionId).toBe('sess-old');
      expect(result.source?.playbackUrl).toContain('/h/');
      expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
    });

    it('keeps a guest session only for the same fingerprint', async () => {
      prisma.videoPlaybackSession.findUnique.mockResolvedValue(session({ userId: null }));
      expect((await renew({ type: 'guest' }, 'sess-old')).tracking.playbackSessionId).toBe('sess-old');
      expect((await renew({ type: 'guest' }, 'sess-old', { ip: 'other', ua: 'ua1' })).tracking.playbackSessionId).toBe('sess-1');
    });

    it.each([
      ['another user', session({ userId: 'u2' })],
      ['another video', session({ videoId: 'other-video-id-123' })],
      ['a session older than a day', session({ createdAt: new Date(Date.now() - 25 * 3600_000) })],
      ['an admin preview session', session({ isAdminPreview: true })],
      ['a missing session', null],
    ])('creates a new session instead of reusing %s', async (_label, existing) => {
      prisma.videoPlaybackSession.findUnique.mockResolvedValue(existing);
      const result = await renew({ type: 'user', userId: 'u1' }, 'sess-old');
      expect(result.tracking.playbackSessionId).toBe('sess-1');
      expect(prisma.videoPlaybackSession.create).toHaveBeenCalledTimes(1);
    });

    it('still runs the access check: a renewal for a viewer who lost access gets no URL', async () => {
      vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'LOGIN_REQUIRED' } } as never);
      prisma.videoPlaybackSession.findUnique.mockResolvedValue(session());
      const result = await renew({ type: 'guest' }, 'sess-old');
      expect(result.canPlay).toBe(false);
      expect(JSON.stringify(result)).not.toContain('/h/');
      expect(prisma.videoPlaybackSession.findUnique).not.toHaveBeenCalled();
    });
  });

  it('only accepts object keys that belong to the video', () => {
    expect(parseSelfHlsObjectKey(`videos/${VIDEO_ID}/v/v1`, VIDEO_ID)).toBe('v1');
    expect(parseSelfHlsObjectKey(`videos/other-video-id/v/v1`, VIDEO_ID)).toBeNull();
    expect(parseSelfHlsObjectKey(`videos/${VIDEO_ID}/v/../x`, VIDEO_ID)).toBeNull();
  });

  it('token signing validates input and honours the base URL', () => {
    expect(() => SelfHlsTokenService.sign({ videoId: '../x', version: 'v1', secret: SECRET })).toThrow();
    expect(() => SelfHlsTokenService.sign({ videoId: VIDEO_ID, version: 'v1', secret: 'short' })).toThrow();
    const signed = SelfHlsTokenService.sign({ videoId: VIDEO_ID, version: 'v1', secret: SECRET, ttlSeconds: 60 }, 'https://example.test');
    expect(signed.masterUrl.startsWith('https://example.test/h/')).toBe(true);
    expect(signed.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 61_000);
    expect(SelfHlsTokenService.baseUrl({ HLS_DELIVERY_BASE_URL: 'https://v.test/' } as never)).toBe('https://v.test');
  });
});
