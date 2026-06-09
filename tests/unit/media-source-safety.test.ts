import { describe, it, expect, vi } from 'vitest';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
    },
    videoPlaybackSession: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/blob', () => ({
    isAllowedVideoSourceUrl: vi.fn().mockReturnValue(true)
}));

describe('PlaybackService Safety', () => {
  const ctx = createAppContext({
    actor: { type: 'guest' },
  });

  it('should not return source if access is denied', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      id: 'v1',
      title: 'Secret Video',
      videoUrl: 'https://s3.amazonaws.com/bucket/secret.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
    } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.access.allowed).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.diagnostics.warnings).toContain('PATRON_REQUIRED');
  });

  it('should redact raw videoUrl even if access is allowed', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      id: 'v1',
      title: 'Public Video',
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      tier: 'PUBLIC',
    } as any);

    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's1' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.access.allowed).toBe(true);
    expect(plan.source).toBeDefined();
    expect(plan.source?.playbackUrl).toBe('/api/media/v1');
    expect(plan.source?.playbackUrl).not.toContain('s3.amazonaws.com');
  });

  it('should allow YouTube URLs without redaction if they are safe', async () => {
     vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      id: 'v1',
      title: 'YouTube Video',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      tier: 'PUBLIC',
    } as any);

    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's1' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.access.allowed).toBe(true);
    expect(plan.source?.kind).toBe('youtube');
    expect(plan.source?.playbackUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
