import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/media-source/[videoId]/route';
import { NextRequest } from 'next/server';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { getActorFromAuth } from '@/lib/api/auth';
import { rateLimit } from '@/lib/rate-limit';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/services/playback/playback.service', () => ({
  PlaybackService: {
    createPlaybackPlanWithContext: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Media-Source Route Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createReq = () => new NextRequest('http://localhost/api/media-source/v1');

  it('redacts raw URLs from public response', async () => {
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

    expect(data.playbackUrl).toBe('/api/media/v1');
    expect(data.source.playbackUrl).toBe('/api/media/v1');
  });

  it('does not redact safe Cloudflare Stream manifests from playable plans', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'patron-1' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'READY',
      canPlay: true,
      access: { allowed: true },
      source: {
        provider: 'CLOUDFLARE_STREAM',
        kind: 'cloudflare_stream',
        playbackUrl: 'https://videodelivery.net/cf-signed-token/manifest/video.m3u8',
        embedUrl: 'https://iframe.videodelivery.net/cf-signed-token',
        asset: {
          provider: 'CLOUDFLARE_STREAM',
          processingState: 'READY',
          providerPlaybackId: 'cf-playback-id'
        }
      },
      diagnostics: { warnings: [] },
      tracking: { playbackSessionId: 's-cf-1' }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access.allowed).toBe(true);
    expect(data.canPlay).toBe(true);
    expect(data.source.provider).toBe('CLOUDFLARE_STREAM');
    expect(data.playbackUrl).toBe('https://videodelivery.net/cf-signed-token/manifest/video.m3u8');
    expect(data.source.playbackUrl).toBe('https://videodelivery.net/cf-signed-token/manifest/video.m3u8');
    expect(data.embedUrl).toBe('https://iframe.videodelivery.net/cf-signed-token');
    expect(data.tracking.playbackSessionId).toBe('s-cf-1');
  });

  it('returns 403 when access is denied and redacts all source fields', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      access: { allowed: false, reason: 'PATRON_REQUIRED' },
      diagnostics: { warnings: ['PATRON_REQUIRED'] },
      tracking: { playbackSessionId: '' }
    });

    const res = await GET(createReq(), { params: Promise.resolve({ videoId: 'v1' }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.hasAccess).toBe(false);
    expect(data.access.reason).toBe('PATRON_REQUIRED');
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
    expect(data.embedUrl).toBeUndefined();
    expect(data.diagnostics.warnings).toEqual(['PATRON_REQUIRED']);
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

  it('derives compatibility URLs only from allowed READY playable plans', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'PATRON_REQUIRED',
      canPlay: false,
      access: { allowed: false, reason: 'PATRON_REQUIRED' },
      source: {
        kind: 'cloudflare_stream',
        playbackUrl: 'https://videodelivery.net/should-not-leak/manifest/video.m3u8',
        embedUrl: 'https://iframe.videodelivery.net/should-not-leak',
      },
      diagnostics: { warnings: ['PATRON_REQUIRED'] },
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

  it('redacts PROCESSING Cloudflare video for allowed patron', async () => {
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

  it('redacts FAILED Cloudflare video for allowed patron', async () => {
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
