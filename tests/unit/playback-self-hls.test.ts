import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { parseSelfHlsObjectKey, pickFallbackAsset } from '@/lib/modules/playback/application/self-hls-plan';
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
  provider: 'CLOUDFLARE_STREAM',
  objectKey: 'cf-uid',
  providerAssetId: 'cf-uid',
  providerPlaybackId: null,
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
    videoPlaybackSession: { create: vi.fn() },
  };

  const selfAsset = asset({ id: 'self', provider: 'SELF_HLS', objectKey: `videos/${VIDEO_ID}/v/v1`, bucket: 'polutek-hls', isPrimary: true });
  const cfAsset = asset({ id: 'cf' });

  function video(over: Record<string, unknown> = {}) {
    const route = { asset: selfAsset };
    return {
      id: VIDEO_ID,
      title: 'Czesc',
      thumbnailUrl: '/t.jpg',
      tier: 'LOGGED_IN',
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 86_400_000),
      premiereAt: null,
      videoUrl: null,
      activePlaybackRoute: route,
      assets: [selfAsset, cfAsset],
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
  });

  it('never exposes any URL or token to a denied viewer', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'LOGIN_REQUIRED' } } as never);
    const result = await plan({ type: 'guest' });
    expect(result.canPlay).toBe(false);
    expect(result.source).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/video\.pawelperfect\.com|self_hls|\/h\//);
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('keeps the premiere gate in front of own HLS', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ premiereAt: new Date(Date.now() + 86_400_000) }));
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.status).toBe('COMING_SOON');
    expect(JSON.stringify(result)).not.toContain('/h/');
  });

  it('plays the previous provider when the delivery secret is not configured', async () => {
    delete process.env.HLS_TOKEN_SECRET;
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = '';
    const result = await plan({ type: 'user', userId: 'u1' });
    expect(result.source?.kind).not.toBe('self_hls');
    expect(JSON.stringify(result)).not.toContain('/h/');
  });

  it('selects only READY CLOUDFLARE_STREAM/MUX assets as fallback, newest first', () => {
    const old = asset({ id: 'o', updatedAt: new Date(1000) });
    const mux = asset({ id: 'm', provider: 'MUX', updatedAt: new Date(5000) });
    const failed = asset({ id: 'f', provider: 'MUX', processingState: 'FAILED', updatedAt: new Date(9000) });
    expect(pickFallbackAsset([old, failed, mux, selfAsset] as never)?.id).toBe('m');
    expect(pickFallbackAsset([selfAsset] as never)).toBeNull();
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
