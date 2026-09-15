import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGatedMedia } from '@/lib/modules/media/application/get-gated-media.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { MediaSourceNotFoundError, MediaAccessDeniedError } from '@/lib/modules/media/domain/media.errors';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

describe('getGatedMedia Use Case', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      video: {
        findFirst: vi.fn(),
      },
    };
  });

  it('returns video metadata when access is allowed', async () => {
    const video = { id: 'v1', videoUrl: 'https://example.com/video.mp4' };
    mockPrisma.video.findFirst.mockResolvedValue(video);
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    const ctx = createAppContext({ actor: { type: 'user', userId: 'u1' }, prisma: mockPrisma });
    const result = await getGatedMedia({ videoIdOrSlug: 'v1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('v1');
      expect(result.data.videoUrl).toBe(video.videoUrl);
    }
  });

  it('fails (does NOT return the videoUrl) when access is PATRON_REQUIRED', async () => {
      const video = { id: 'v1', videoUrl: 'https://example.com/video.mp4' };
      mockPrisma.video.findFirst.mockResolvedValue(video);
      vi.mocked(checkVideoAccess).mockResolvedValue({
        ok: true,
        data: { hasAccess: false, reason: 'PATRON_REQUIRED' } as any,
      });

      const ctx = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma });
      const result = await getGatedMedia({ videoIdOrSlug: 'v1' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(MediaAccessDeniedError);
        expect((result.error as any).statusCode).toBe(403);
      }
      // Belt-and-suspenders: no branch of this function may ever hand back
      // the real videoUrl alongside a denied decision.
      expect(JSON.stringify(result)).not.toContain(video.videoUrl);
  });

  it('fails (does NOT return the videoUrl) when access is LOGIN_REQUIRED', async () => {
      const video = { id: 'v1', videoUrl: 'https://example.com/video.mp4' };
      mockPrisma.video.findFirst.mockResolvedValue(video);
      vi.mocked(checkVideoAccess).mockResolvedValue({
        ok: true,
        data: { hasAccess: false, reason: 'LOGIN_REQUIRED' } as any,
      });

      const ctx = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma });
      const result = await getGatedMedia({ videoIdOrSlug: 'v1' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(MediaAccessDeniedError);
        expect((result.error as any).statusCode).toBe(403);
      }
      expect(JSON.stringify(result)).not.toContain(video.videoUrl);
  });

  it('returns fail(MediaSourceNotFoundError) when video does not exist', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(null);

    const ctx = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma });
    const result = await getGatedMedia({ videoIdOrSlug: 'non-existent' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(MediaSourceNotFoundError);
    }
  });

  it('returns fail(MediaSourceNotFoundError) when access check returns NOT_FOUND', async () => {
      const video = { id: 'v1', videoUrl: 'https://example.com/video.mp4' };
      mockPrisma.video.findFirst.mockResolvedValue(video);
      vi.mocked(checkVideoAccess).mockResolvedValue({
        ok: true,
        data: { hasAccess: false, reason: 'NOT_FOUND' } as any,
      });

      const ctx = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma });
      const result = await getGatedMedia({ videoIdOrSlug: 'v1' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(MediaSourceNotFoundError);
      }
  });
});
