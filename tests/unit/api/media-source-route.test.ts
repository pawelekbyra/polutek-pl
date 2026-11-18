import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/media-source/[videoId]/route';
import { NextRequest } from 'next/server';
import { PlaybackService } from '@/lib/modules/playback';
import { getActorFromAuth } from '@/lib/api/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PlaybackPlanResponseSchema } from '@/lib/video-api-contracts/contracts';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/playback', async () => ({
  PlaybackService: {
    createPlaybackPlanWithContext: vi.fn(),
  },
  // The real sanitizer: this suite tests what the route lets out.
  toPublicPlaybackPlan: (await import('@/lib/modules/playback/application/public-playback-plan')).toPublicPlaybackPlan,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Media-Source Route Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createReq = () => new NextRequest('http://localhost/api/media-source/v1');

  it('drops raw storage URLs from the public response', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'READY',
      canPlay: true,
      access: { allowed: true },
      source: {
        playbackUrl: 'https://s3.amazonaws.com/private-bucket/v1.mp4?signature=123',
        kind: 'video'
      },
      diagnostics: { warnings: [] },
      tracking: { playbackSessionId: 's1' }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    const data = await res.json();

    // A raw storage URL is never forwarded: the source is dropped and the plan is not playable.
    expect(data.canPlay).toBe(false);
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
    expect(data.kind).toBeUndefined();
    expect(data.tracking.playbackSessionId).toBe('');
    expect(JSON.stringify(data)).not.toContain('amazonaws');
  });

  it('does not redact the signed own-HLS delivery URL and returns the playback contract', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'patron-1' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'READY',
      canPlay: true,
      access: { allowed: true },
      source: {
        provider: 'SELF_HLS',
        kind: 'self_hls',
        playbackUrl: 'https://video.pawelperfect.com/h/1790000000.sig/v1/v1/master.m3u8',
        isSignedUrl: true,
        asset: {
          provider: 'SELF_HLS',
          processingState: 'READY',
          isPrimary: true,
        }
      },
      player: { autoplayAllowed: false, mutedAutoplay: false, controls: true, poster: '', title: 'Film' },
      diagnostics: { warnings: [], sourceConfidence: 'HIGH', providerResolutionAllowed: false, providerResolutionAttempted: true },
      tracking: { playbackSessionId: 's-cf-1', heartbeatIntervalSeconds: 15 }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(PlaybackPlanResponseSchema.safeParse(data).success).toBe(true);
    expect(data.access.allowed).toBe(true);
    expect(data.canPlay).toBe(true);
    expect(data.source.provider).toBe('SELF_HLS');
    expect(data.playbackUrl).toBe('https://video.pawelperfect.com/h/1790000000.sig/v1/v1/master.m3u8');
    expect(data.source.playbackUrl).toBe('https://video.pawelperfect.com/h/1790000000.sig/v1/v1/master.m3u8');
    expect(data.embedUrl).toBeUndefined();
    expect(data.tracking.playbackSessionId).toBe('s-cf-1');
  });

  it('returns 403 when access is denied and redacts all source fields', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      access: { allowed: false, reason: 'LOGIN_REQUIRED' },
      diagnostics: { warnings: ['LOGIN_REQUIRED'] },
      tracking: { playbackSessionId: '' }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.hasAccess).toBe(false);
    expect(data.access.reason).toBe('LOGIN_REQUIRED');
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
    expect(data.embedUrl).toBeUndefined();
    expect(data.diagnostics.warnings).toEqual(['LOGIN_REQUIRED']);
  });

  it('returns 403 when LOGIN_REQUIRED and redacts all source fields', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      access: { allowed: false, reason: 'LOGIN_REQUIRED' },
      diagnostics: { warnings: ['LOGIN_REQUIRED'] },
      tracking: { playbackSessionId: '' }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.hasAccess).toBe(false);
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
  });

  it.each([
    ['guest', { type: 'guest' }],
    ['signed-in stranger', { type: 'user', userId: 'stranger-1' }],
  ] as const)('redacts hidden premiere metadata from the HTTP response for a %s', async (_label, actor) => {
    (getActorFromAuth as any).mockResolvedValue(actor);
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'hidden-video-id',
      status: 'UNAVAILABLE',
      canPlay: false,
      premiereAt: '2026-12-24T18:00:00.000Z',
      access: { allowed: false, reason: 'VIDEO_NOT_FOUND', offer: { price: 999 } },
      source: { provider: 'SELF_HLS', kind: 'self_hls', playbackUrl: 'https://video.pawelperfect.com/secret-token/master.m3u8', isSignedUrl: true },
      player: { autoplayAllowed: false, mutedAutoplay: false, controls: true, poster: 'Secret poster', title: 'Secret premiere title', textTracks: [{ src: '/secret.vtt', label: 'Secret', language: 'pl', kind: 'subtitles' }], chapters: [{ title: 'Secret chapter', start: 0 }] },
      diagnostics: { warnings: ['Secret premiere title'], sourceConfidence: 'HIGH', providerResolutionAllowed: true, providerResolutionAttempted: true, sourceMode: 'PROVIDER_ASSET', asset: { provider: 'SELF_HLS', processingState: 'READY', isPrimary: true } },
      tracking: { playbackSessionId: 'secret-session', heartbeatIntervalSeconds: 15 },
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'hidden-video-id' }) });
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).not.toContain('Secret premiere title');
    expect(body).not.toContain('Secret poster');
    expect(body).not.toContain('2026-12-24T18:00:00.000Z');
    expect(body).not.toContain('secret-token');
    expect(body).not.toContain('secret-session');
    expect(body).not.toContain('Secret chapter');
    expect(body).not.toContain('/secret.vtt');
    const data = JSON.parse(body);
    expect(data.player.title).toBe('');
    expect(data.player.poster).toBe('');
    expect(data.access).toEqual({ allowed: false, reason: 'VIDEO_NOT_FOUND' });
    expect(data.premiereAt).toBeUndefined();
    expect(data.tracking.playbackSessionId).toBe('');
  });

  it('derives compatibility URLs only from allowed READY playable plans', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'LOGIN_REQUIRED',
      canPlay: false,
      access: { allowed: false, reason: 'LOGIN_REQUIRED' },
      source: {
        kind: 'self_hls',
        playbackUrl: 'https://video.pawelperfect.com/h/1790000000.sig/v1/v1/master.m3u8?should-not-leak',
      },
      diagnostics: { warnings: ['LOGIN_REQUIRED'] },
      tracking: { playbackSessionId: 'should-not-count', heartbeatIntervalSeconds: 15 },
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.hasAccess).toBe(false);
    expect(data.kind).toBeUndefined();
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
    expect(data.embedUrl).toBeUndefined();
    expect(data.tracking.playbackSessionId).toBe('');
  });

  it('requires videoId param', async () => {
    const res = await GET(createReq(), { params: Promise.resolve({ videoId: '' }) });
    expect(res.status).toBe(400);
  });

  it('redacts PROCESSING own-HLS video for allowed patron', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'patron-1' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'PROCESSING',
      canPlay: false,
      access: { allowed: true },
      source: undefined,
      diagnostics: { warnings: ['Video asset is PROCESSING'] },
      tracking: { playbackSessionId: '' }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('PROCESSING');
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
  });

  it('redacts FAILED own-HLS video for allowed patron', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'patron-1' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'UNAVAILABLE',
      canPlay: false,
      access: { allowed: true },
      source: undefined,
      diagnostics: { warnings: ['Video asset processing failed'] },
      tracking: { playbackSessionId: '' }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('UNAVAILABLE');
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
  });
});
