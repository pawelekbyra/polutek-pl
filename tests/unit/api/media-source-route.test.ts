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
      access: { allowed: true },
      source: {
        playbackUrl: 'https://s3.amazonaws.com/private-bucket/v1.mp4?signature=123',
        kind: 'video'
      },
      diagnostics: { warnings: [] },
      tracking: { playbackSessionId: 's1' }
    });

    const res = await GET(createReq(), { params: { videoId: 'v1' } });
    const data = await res.json();

    expect(data.playbackUrl).toBe('/api/media/v1');
    expect(data.source.playbackUrl).toBe('/api/media/v1');
  });

  it('returns 403 when access is denied and redacts all source fields', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      access: { allowed: false, reason: 'PATRON_REQUIRED' },
      diagnostics: { warnings: ['PATRON_REQUIRED'] },
      tracking: { playbackSessionId: '' }
    });

    const res = await GET(createReq(), { params: { videoId: 'v1' } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.hasAccess).toBe(false);
    expect(data.access.reason).toBe('PATRON_REQUIRED');
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
    expect(data.embedUrl).toBeUndefined();
    // Verify no signed URL or provider tokens leaked in diagnostics
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

    const res = await GET(createReq(), { params: { videoId: 'v1' } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.hasAccess).toBe(false);
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
  });

  it('requires videoId param', async () => {
    const res = await GET(createReq(), { params: { videoId: '' } });
    expect(res.status).toBe(400);
  });

  it('returns safe asset metadata but no playbackUrl for READY Cloudflare video', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'patron-1' });
    (PlaybackService.createPlaybackPlanWithContext as any).mockResolvedValue({
      videoId: 'v1',
      status: 'READY',
      canPlay: false,
      access: { allowed: true },
      source: {
        provider: 'CLOUDFLARE_STREAM',
        kind: 'cloudflare_stream',
        asset: {
          provider: 'CLOUDFLARE_STREAM',
          processingState: 'READY',
          providerPlaybackId: 'cf-playback-id'
        }
      },
      diagnostics: { warnings: ['Provider resolution gated'] },
      tracking: { playbackSessionId: '' }
    });

    const res = await GET(createReq(), { params: { videoId: 'v1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access.allowed).toBe(true);
    expect(data.source.provider).toBe('CLOUDFLARE_STREAM');
    expect(data.source.asset.providerPlaybackId).toBe('cf-playback-id');
    expect(data.playbackUrl).toBeUndefined();
    expect(data.source.playbackUrl).toBeUndefined();
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

    const res = await GET(createReq(), { params: { videoId: 'v1' } });
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

    const res = await GET(createReq(), { params: { videoId: 'v1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('UNAVAILABLE');
    expect(data.source).toBeUndefined();
    expect(data.playbackUrl).toBeUndefined();
  });
});
